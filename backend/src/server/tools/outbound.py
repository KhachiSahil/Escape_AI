"""Outbound call origination via the Twilio REST API.

Not an LLM-callable tool - the agent never decides mid-conversation to place
an outbound call. This is invoked by whatever business process initiates a
cold call (see trigger_outbound_call.py for a manual/CLI entry point).
Pipecat itself has no call-origination logic; once Twilio connects to our
/ws endpoint, the resulting call is handled identically to an inbound one
by bot.py's WebSocketRunnerArguments case.
"""

from loguru import logger
from twilio.base.exceptions import TwilioRestException
from twilio.rest import Client

import config


class OutboundCallError(Exception):
    """Raised when Twilio rejects or fails to originate the call."""


def originate_call(to_phone_number: str) -> str:
    """Places an outbound call to to_phone_number via Twilio.

    Twilio fetches TWILIO_TWIML_WEBHOOK_URL once the callee answers, which
    returns a <Connect><Stream> document pointing at this server's /ws
    route - from that point on, Pipecat treats it like any inbound call.

    Returns the Twilio Call SID on success.
    """
    if not (config.TWILIO_ACCOUNT_SID and config.TWILIO_AUTH_TOKEN):
        raise OutboundCallError("TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN are not configured")
    if not config.TWILIO_PHONE_NUMBER:
        raise OutboundCallError("TWILIO_PHONE_NUMBER is not configured")
    if not config.TWILIO_TWIML_WEBHOOK_URL:
        raise OutboundCallError("TWILIO_TWIML_WEBHOOK_URL is not configured")

    client = Client(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN)
    try:
        call = client.calls.create(
            to=to_phone_number,
            from_=config.TWILIO_PHONE_NUMBER,
            url=config.TWILIO_TWIML_WEBHOOK_URL,
        )
    except TwilioRestException as exc:
        logger.error(f"Twilio call origination failed for {to_phone_number}: {exc}")
        raise OutboundCallError(str(exc)) from exc

    call_sid = call.sid
    if not call_sid:
        raise OutboundCallError("Twilio did not return a call SID")

    logger.info(f"Originated outbound call {call_sid} to {to_phone_number}")
    return call_sid
