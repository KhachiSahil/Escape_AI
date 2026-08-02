from pipecat.adapters.schemas.tools_schema import ToolsSchema

from tools.leads import (
    create_lead,
    create_lead_function,
    finalize_call_summary,
    finalize_call_summary_function,
    request_human_escalation,
    request_human_escalation_function,
    schedule_callback,
    schedule_callback_function,
    update_lead,
    update_lead_function,
)

TOOLS = [
    create_lead_function,
    update_lead_function,
    schedule_callback_function,
    request_human_escalation_function,
    finalize_call_summary_function,
]

HANDLERS = {
    "create_lead": create_lead,
    "update_lead": update_lead,
    "schedule_callback": schedule_callback,
    "request_human_escalation": request_human_escalation,
    "finalize_call_summary": finalize_call_summary,
}

tools_schema = ToolsSchema(standard_tools=TOOLS)


def register_all_tools(llm):
    for name, handler in HANDLERS.items():
        llm.register_function(name, handler)
