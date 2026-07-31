from pipecat.adapters.schemas.tools_schema import ToolsSchema
from tools.tickets import create_followup, create_followup_function

TOOLS = [
    create_followup_function,
]

HANDLERS = {
    "create_followup": create_followup,
}

tools_schema = ToolsSchema(standard_tools=TOOLS)


def register_all_tools(llm):
    for name, handler in HANDLERS.items():
        llm.register_function(name, handler)