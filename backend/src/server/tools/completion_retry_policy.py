"""Retry/fallback policy for the Groq tool-call-parser 400 failure mode.

Groq's tool-call parser for llama-3.3-70b-versatile occasionally rejects a
completion outright with a "tool_use_failed" 400 error - the same
underlying quirk documented in tools/leaked_tool_call_filter.py, just
surfacing as an error response instead of leaked text. Without any
handling, pipecat logs the error and moves on: the caller hears complete
silence for that turn. This policy decides what to do on each failure -
retry once (the failure is model non-determinism, so a retry often
succeeds), then fall back to a spoken line rather than silence if it fails
twice in a row.
"""

from enum import Enum, auto


class RetryAction(Enum):
    """What the caller should do in response to a completion failure."""

    IGNORE = auto()
    RETRY = auto()
    FALLBACK = auto()


_ERROR_MARKERS = ("tool_use_failed", "Error during completion")


class CompletionRetryPolicy:
    """Tracks consecutive LLM completion failures and decides retry vs.
    fallback. Not thread-safe - intended for one voice-agent session.
    """

    def __init__(self):
        self._consecutive_failures = 0

    def on_success(self) -> None:
        """Call when a completion actually produced text - resets the
        counter so a later, unrelated failure isn't miscounted as part of
        an earlier retry sequence."""
        self._consecutive_failures = 0

    def on_error(self, error_message: str) -> RetryAction:
        """Call on every pipeline error frame. Returns IGNORE for errors
        unrelated to this failure mode (so callers don't retry on e.g. a
        network timeout, which pipecat already surfaces its own way)."""
        if not any(marker in error_message for marker in _ERROR_MARKERS):
            return RetryAction.IGNORE

        self._consecutive_failures += 1
        if self._consecutive_failures == 1:
            return RetryAction.RETRY

        self._consecutive_failures = 0
        return RetryAction.FALLBACK
