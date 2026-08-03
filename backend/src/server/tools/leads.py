"""Lead/call/escalation tools for the EdTech sales voice agent.

Each tool is a thin wrapper that calls the CRM API (backend/api). Tool
handlers never fabricate data - if the API call fails, the caller is told
honestly rather than pretending the action succeeded.
"""

import asyncio

from loguru import logger
from pipecat.adapters.schemas.function_schema import FunctionSchema
from pipecat.services.llm_service import FunctionCallParams

from tools.api_client import CrmApiError, request

# Tracks the current call's lead id in-process, set once create_lead
# succeeds, so bot.py can call log_call_summary on disconnect.
current_lead_id: str | None = None

# Set once finalize_call_summary has actually been called this session, so
# bot.py's disconnect handler knows not to double-log a call record.
call_summary_finalized: bool = False


def _fire_and_forget(coro, description: str) -> None:
    """Run coro in the background without blocking the conversation turn.

    Only used for tool calls whose result the LLM never reads back — a
    plain asyncio.create_task would otherwise silently swallow exceptions,
    so failures are logged via a done-callback instead.
    """
    task = asyncio.create_task(coro)

    def _log_if_failed(t: asyncio.Task) -> None:
        if t.exception():
            logger.error(f"Fire-and-forget task failed ({description}): {t.exception()}")

    task.add_done_callback(_log_if_failed)


create_lead_function = FunctionSchema(
    name="create_lead",
    description=(
        "Create a new lead record as soon as you have at least the "
        "caller's name, phone number, and the course they're interested in. "
        "Call this once per call, the first time you have enough details."
    ),
    properties={
        "name": {"type": "string", "description": "Caller's full name"},
        "phone": {"type": "string", "description": "Caller's phone number"},
        "email": {"type": "string", "description": "Caller's email, if provided"},
        "profession": {
            "type": "string",
            "description": "e.g. 'student', 'working professional', or their job title",
        },
        "experienceLevel": {
            "type": "string",
            "description": "Caller's experience level in the interested course area",
        },
        "courseInterested": {
            "type": "string",
            "description": "The course the caller is interested in",
        },
        "budget": {"type": "string", "description": "Caller's stated budget range, if any"},
    },
    required=["name", "phone", "courseInterested"],
)

update_lead_function = FunctionSchema(
    name="update_lead",
    description=(
        "Update the lead record as you learn more during the call - "
        "buying intent, urgency, notes, lead score, status, priority, or the "
        "numeric 1-10 sub-scores (budgetScore/urgencyScore/interestScore/"
        "buyingSignalsScore/courseFitScore/callQualityScore). Only include "
        "fields you actually learned; never overwrite with guesses. "
        "Set leadScore/status when the caller shows strong buying signals "
        "(e.g. leadScore=HOT, status=QUALIFIED) or clearly disengages "
        "(e.g. leadScore=LOST, status=LOST). Set priority (P1-P4) based on how "
        "urgent and time-sensitive their interest is, independent of how "
        "positive/negative leadScore is - a HOT lead exploring for next year is "
        "P3-P4, not P1. The numeric sub-scores feed a separate composite "
        "scoring formula - set them whenever you have real signal for that "
        "specific factor, independent of leadScore/priority."
    ),
    properties={
        "leadId": {"type": "string", "description": "The lead id returned by create_lead"},
        "intent": {"type": "string", "description": "Detected buying intent, e.g. 'high', 'medium', 'low'"},
        "urgency": {"type": "string", "description": "Detected urgency, e.g. 'immediate', 'this month', 'exploring'"},
        "budget": {"type": "string", "description": "Caller's budget range"},
        "notes": {"type": "string", "description": "Any other relevant detail from the conversation"},
        "leadScore": {
            "type": "string",
            "enum": ["HOT", "WARM", "COLD", "VERY_HOT", "LOST", "DORMANT", "RE_ENGAGE"],
            "description": "Your assessment of this lead's quality based on the conversation so far",
        },
        "status": {
            "type": "string",
            "enum": ["NEW", "QUALIFIED", "CALLBACK_SCHEDULED", "ESCALATED", "CONVERTED", "LOST", "DORMANT"],
            "description": "Lead lifecycle status",
        },
        "priority": {
            "type": "string",
            "enum": ["P1", "P2", "P3", "P4"],
            "description": (
                "This lead's urgency/importance tier for human follow-up. "
                "P1 = ready to enroll now or extremely time-sensitive "
                "(e.g. explicit immediate intent, asking how to pay today). "
                "P2 = strong genuine interest with a concrete near-term "
                "timeline (e.g. wants to start this month, comparing "
                "specific batches). P3 = interested but no committed "
                "timeline or still deciding. P4 = early-stage or just "
                "exploring, no urgency signals yet. Set this whenever you "
                "have enough signal to judge urgency, and update it if that "
                "signal changes during the call."
            ),
        },
        "budgetScore": {
            "type": "integer",
            "description": (
                "1-10: how ready/able the caller is to pay. 1 = no budget or "
                "explicitly can't afford it, 10 = budget confirmed and ready "
                "to pay now. Only set once you have real signal, not a guess."
            ),
        },
        "urgencyScore": {
            "type": "integer",
            "description": (
                "1-10: how time-sensitive their interest is. 1 = no urgency, "
                "just browsing, 10 = wants to start immediately."
            ),
        },
        "interestScore": {
            "type": "integer",
            "description": (
                "1-10: overall genuine interest/engagement level in the "
                "conversation, independent of budget or urgency."
            ),
        },
        "buyingSignalsScore": {
            "type": "integer",
            "description": (
                "1-10: strength of concrete buying signals observed (e.g. "
                "asking about payment steps, batch start dates) vs. none."
            ),
        },
        "courseFitScore": {
            "type": "integer",
            "description": (
                "1-10: how well the caller's stated goals/background actually "
                "fit the course they're interested in."
            ),
        },
        "callQualityScore": {
            "type": "integer",
            "description": (
                "1-10: quality/depth of this conversation itself (e.g. a "
                "short, evasive call scores low; a substantive, engaged "
                "conversation scores high), independent of the caller's "
                "buying intent."
            ),
        },
    },
    required=["leadId"],
)

schedule_callback_function = FunctionSchema(
    name="schedule_callback",
    description=(
        "Schedule a follow-up callback at a specific time the caller has "
        "confirmed out loud."
    ),
    properties={
        "leadId": {"type": "string", "description": "The lead id returned by create_lead"},
        "callbackTime": {
            "type": "string",
            "description": "The agreed callback time, in ISO 8601 format if possible",
        },
        "notes": {"type": "string", "description": "Why the callback is needed"},
    },
    required=["leadId", "callbackTime"],
)

request_human_escalation_function = FunctionSchema(
    name="request_human_escalation",
    description=(
        "Hand the caller off to a human team member immediately - do not "
        "try to resolve the issue yourself first. Use for pricing "
        "negotiation beyond listed offers, refund disputes, complaints, "
        "anger, complex admissions, scholarship approval, payment failure, "
        "a parent/family member wanting a counselor, or repeated requests "
        "for a human."
    ),
    properties={
        "leadId": {"type": "string", "description": "The lead id returned by create_lead"},
        "reason": {
            "type": "string",
            "enum": [
                "pricing_negotiation",
                "refund_dispute",
                "complaint",
                "complex_admission",
                "scholarship_approval",
                "payment_failure",
                "parent_counselor_request",
                "requested_human",
            ],
            "description": "Category of why this needs a human",
        },
        "summary": {"type": "string", "description": "Short summary of the situation for the human"},
    },
    required=["leadId", "reason", "summary"],
)


finalize_call_summary_function = FunctionSchema(
    name="finalize_call_summary",
    description=(
        "Call this once, when you sense the conversation is wrapping up "
        "(the caller is saying goodbye, the call is about to end, or you've "
        "covered everything needed). Summarize the call so the CRM has an "
        "accurate record. Only include what was actually discussed - never "
        "invent details."
    ),
    properties={
        "leadId": {"type": "string", "description": "The lead id returned by create_lead"},
        "shortSummary": {"type": "string", "description": "One-sentence summary of the call"},
        "detailedSummary": {"type": "string", "description": "A fuller summary of what was discussed"},
        "keyPoints": {"type": "string", "description": "Key points from the conversation"},
        "intent": {"type": "string", "description": "Overall buying intent, e.g. 'high', 'medium', 'low'"},
        "urgency": {"type": "string", "description": "Overall urgency, e.g. 'immediate', 'this month', 'exploring'"},
        "sentiment": {"type": "string", "description": "Overall caller sentiment, e.g. 'positive', 'neutral', 'negative'"},
        "goals": {"type": "string", "description": "The caller's stated career/learning goals"},
        "painPoints": {"type": "string", "description": "Pain points the caller mentioned"},
        "nextSteps": {"type": "string", "description": "Agreed or recommended next steps"},
        "buyingSignals": {"type": "string", "description": "Specific signals suggesting purchase intent"},
        "objections": {"type": "string", "description": "Objections or concerns the caller raised"},
        "recommendedAction": {"type": "string", "description": "What a human follow-up should focus on, if any"},
    },
    required=["leadId", "shortSummary"],
)


async def create_lead(params: FunctionCallParams) -> None:
    global current_lead_id
    args = params.arguments
    try:
        lead = await request("POST", "/api/leads", json=args)
        current_lead_id = lead.get("id")
        logger.info(f"Created lead {current_lead_id}")
        await params.result_callback({"leadId": current_lead_id, "status": "created"})
    except CrmApiError:
        await params.result_callback(
            {"status": "error", "message": "Could not save your details right now."}
        )


async def update_lead(params: FunctionCallParams) -> None:
    """Fire-and-forget: the LLM never reads this result back into the
    conversation, so the write happens in the background instead of
    blocking the current turn on a CRM API round-trip.
    """
    args = dict(params.arguments)
    lead_id = args.pop("leadId", None)
    if not lead_id:
        await params.result_callback({"status": "error", "message": "Missing leadId"})
        return
    await params.result_callback({"status": "updating"})
    _fire_and_forget(
        request("PATCH", f"/api/leads/{lead_id}", json=args),
        description=f"update_lead {lead_id}",
    )


async def schedule_callback(params: FunctionCallParams) -> None:
    args = params.arguments
    lead_id = args.get("leadId")
    try:
        await request(
            "POST",
            f"/api/leads/{lead_id}/callback",
            json={"callbackTime": args.get("callbackTime"), "notes": args.get("notes")},
        )
        await params.result_callback({"status": "scheduled"})
    except CrmApiError:
        await params.result_callback({"status": "error", "message": "Could not schedule callback."})


async def request_human_escalation(params: FunctionCallParams) -> None:
    args = params.arguments
    try:
        result = await request(
            "POST",
            "/api/escalations",
            json={
                "leadId": args.get("leadId"),
                "reason": args.get("reason"),
                "summary": args.get("summary"),
            },
        )
        await params.result_callback(
            {
                "status": result.get("status", "assigned"),
                "message": (
                    "A team member will call you back shortly."
                    if result.get("status") != "queued"
                    else "Our team is currently busy, but someone will follow up as soon as possible."
                ),
            }
        )
    except CrmApiError:
        await params.result_callback(
            {"status": "error", "message": "Could not reach our team system, but I've noted your request."}
        )


async def log_call_summary(
    lead_id: str,
    call_type: str,
    short_summary: str | None = None,
    detailed_summary: str | None = None,
    key_points: str | None = None,
    intent: str | None = None,
    urgency: str | None = None,
    sentiment: str | None = None,
    goals: str | None = None,
    pain_points: str | None = None,
    next_steps: str | None = None,
    buying_signals: str | None = None,
    objections: str | None = None,
    recommended_action: str | None = None,
) -> None:
    """Writes a Call record to the CRM API.

    Called two ways: as the fallback from bot.py's on_client_disconnected
    (call_type only, everything else None) if finalize_call_summary was
    never invoked this session, or via finalize_call_summary below with the
    LLM's actual summary of the call.
    """
    try:
        await request(
            "POST",
            "/api/calls",
            json={
                "leadId": lead_id,
                "callType": call_type,
                "shortSummary": short_summary,
                "detailedSummary": detailed_summary,
                "keyPoints": key_points,
                "intent": intent,
                "urgency": urgency,
                "sentiment": sentiment,
                "goals": goals,
                "painPoints": pain_points,
                "nextSteps": next_steps,
                "buyingSignals": buying_signals,
                "objections": objections,
                "recommendedAction": recommended_action,
            },
        )
    except CrmApiError:
        logger.error(f"Failed to log call summary for lead {lead_id}")


async def finalize_call_summary(params: FunctionCallParams) -> None:
    global call_summary_finalized
    args = params.arguments
    lead_id = args.get("leadId")
    if not lead_id:
        await params.result_callback({"status": "error", "message": "Missing leadId"})
        return

    call_summary_finalized = True
    await log_call_summary(
        lead_id=lead_id,
        call_type="AI_INBOUND",
        short_summary=args.get("shortSummary"),
        detailed_summary=args.get("detailedSummary"),
        key_points=args.get("keyPoints"),
        intent=args.get("intent"),
        urgency=args.get("urgency"),
        sentiment=args.get("sentiment"),
        goals=args.get("goals"),
        pain_points=args.get("painPoints"),
        next_steps=args.get("nextSteps"),
        buying_signals=args.get("buyingSignals"),
        objections=args.get("objections"),
        recommended_action=args.get("recommendedAction"),
    )
    await params.result_callback({"status": "logged"})
