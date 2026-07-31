"""create_followup tool.

Currently backed by an in-memory mock store. Swap FOLLOWUPS and the body
of create_followup for a real write once decided - either to the FollowUp
table in Postgres/Supabase, or to the same Excel staging file used by
create_enquiry. The function signature and schema can stay the same
either way.
"""

import uuid
from datetime import datetime

from loguru import logger
from pipecat.adapters.schemas.function_schema import FunctionSchema
from pipecat.services.llm_service import FunctionCallParams

create_followup_function = FunctionSchema(
    name="create_followup",
    description=(
        "Log a callback request when the caller's question can't be resolved "
        "from the knowledge base, the issue is complex (refund disputes, "
        "itinerary changes, complaints), or they explicitly ask to speak to a "
        "human. Always confirm the summary with the caller before calling this."
    ),
    properties={
        "customer_phone": {
            "type": "string",
            "description": "Phone number to call the customer back on",
        },
        "issue_summary": {
            "type": "string",
            "description": "Short summary of the request, e.g. 'Refund query for Goa trip'",
        },
        "description": {
            "type": "string",
            "description": "Fuller description of the issue based on the conversation",
        },
        "priority": {
            "type": "string",
            "enum": ["low", "medium", "high"],
            "description": "Urgency of the callback",
        },
        "destination": {
            "type": "string",
            "description": "Relevant destination, if applicable",
        },
        "enquiry_id": {
            "type": "string",
            "description": "Existing enquiry or booking reference, if the caller has one",
        },
    },
    required=["customer_phone", "issue_summary", "description", "priority"],
)

# In-memory mock store (resets on restart). Replace with a real write to
# Postgres (FollowUp table) or the Excel staging file once decided.
FOLLOWUPS: dict[str, dict] = {}


async def create_followup(params: FunctionCallParams) -> None:
    """Mock followup creation - stores in memory and returns a followup ID."""
    args = params.arguments
    followup_id = f"FOLLOWUP-{uuid.uuid4().hex[:8].upper()}"

    followup = {
        "id": followup_id,
        "customer_phone": args.get("customer_phone"),
        "issue_summary": args.get("issue_summary"),
        "description": args.get("description"),
        "priority": args.get("priority", "medium"),
        "destination": args.get("destination", "not provided"),
        "enquiry_id": args.get("enquiry_id", "not linked"),
        "status": "pending",
        "created_at": datetime.utcnow().isoformat(),
    }
    FOLLOWUPS[followup_id] = followup
    logger.info(f"Created followup: {followup}")

    await params.result_callback(
        {
            "followup_id": followup_id,
            "status": "created",
            "message": (
                f"Got it, reference {followup_id} - "
                "a travel consultant will call you back."
            ),
        }
    )