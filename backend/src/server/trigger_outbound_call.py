"""Manual CLI entry point to originate an outbound call via Twilio.

Usage:
    python trigger_outbound_call.py +15551234567

Requires bot.py to already be running with `-t twilio -x <public-host>` so
Twilio has a live TwiML webhook + /ws endpoint to connect to. This script
only places the call; the actual conversation runs through bot.py's
existing pipeline once Twilio opens the Media Streams WebSocket.
"""

import sys

from loguru import logger

from tools.outbound import OutboundCallError, originate_call


def main() -> None:
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)

    to_phone_number = sys.argv[1]
    try:
        call_sid = originate_call(to_phone_number)
    except OutboundCallError as exc:
        logger.error(f"Could not place outbound call: {exc}")
        sys.exit(1)

    print(f"Call placed: {call_sid}")


if __name__ == "__main__":
    main()
