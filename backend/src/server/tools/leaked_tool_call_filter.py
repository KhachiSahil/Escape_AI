"""Safety net for a documented Llama-3.x-on-Groq tool-calling quirk.

Groq's native tool-call parser for llama-3.3-70b-versatile occasionally
fails to convert a real tool call into the structured `tool_calls` delta
and instead leaks it as literal text in the model's own response, e.g.:

    <function=create_lead>{"name": "Chandra", "phone": "not provided", ...}</function>

Nothing in pipecat inspects LLM text for this pattern - it flows straight
to TTS and gets read aloud verbatim (confirmed via a live transcript). This
processor sits between the LLM and TTS: it buffers just enough trailing
text to detect a `<function=...>` tag spanning multiple streamed chunks,
strips any match before it reaches TTS, and manually dispatches the parsed
call to the matching tool handler - since a leaked tag means the call
never fired through pipecat's normal structured path, simply stripping the
text would silently drop the create_lead/update_lead/etc. side effect
entirely.
"""

import json
import re
from typing import cast

from loguru import logger
from pipecat.frames.frames import (
    Frame,
    LLMFullResponseEndFrame,
    LLMFullResponseStartFrame,
    LLMTextFrame,
)
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
from pipecat.services.llm_service import FunctionCallParams

from tools import HANDLERS

# Matches a complete <function=name>{...}</function> tag. Non-greedy on the
# JSON body since a response could (in theory) contain more than one.
_TAG_PATTERN = re.compile(r"<function=(\w+)>(\{.*?\})</function>", re.DOTALL)

# The fixed, unambiguous marker that starts a tag - checked as a plain
# substring (not a regex) so a variable-length tool name or a missing
# closing ">" after it can never let part of an in-progress tag leak
# through as if it were ordinary speech.
_TAG_OPENER = "<function="

# Safety cap: if "<function=" opens and never closes within this many
# characters (a genuinely malformed/truncated tag, not real streaming
# delay), stop holding the buffer hostage and speak it as-is rather than
# silently swallowing the rest of the turn.
_MAX_HOLD_CHARS = 4000


def _partial_opener_suffix_len(text: str) -> int:
    """Length of the longest trailing suffix of text that is itself a
    prefix of "<function=" (including the empty suffix, length 0).

    Used to hold back only the exact fragment that could still grow into
    the opener as more streamed text arrives - e.g. a buffer ending in
    "hello <fun" has a 4-char partial match ("<fun"); "hello there" has none.
    """
    max_check = min(len(text), len(_TAG_OPENER))
    for length in range(max_check, 0, -1):
        if _TAG_OPENER.startswith(text[-length:]):
            return length
    return 0


class _FakeFunctionCallParams:
    """Minimal stand-in for pipecat's FunctionCallParams. Every handler in
    tools/leads.py only ever touches .arguments and .result_callback - kept
    untyped here (not a real FunctionCallParams) so this file doesn't need
    to fabricate the rest of that dataclass's fields; cast to
    FunctionCallParams only at handler call sites, mirroring the pattern
    tests/test_leads_tools.py already uses for the same reason."""

    def __init__(self, arguments: dict):
        self.arguments = arguments

    async def result_callback(self, _result: dict) -> None:
        # The LLM already produced (and, per this leak, already "said") its
        # response for this turn - there's no further turn to feed a tool
        # result back into, so the result is just logged, not re-injected.
        pass

    def as_params(self) -> FunctionCallParams:
        return cast(FunctionCallParams, self)


class LeakedToolCallFilter(FrameProcessor):
    """Strips leaked `<function=name>{json}</function>` tags from LLM text
    before it reaches TTS, and dispatches the parsed call to the real tool
    handler so the CRM write still happens.
    """

    def __init__(self):
        super().__init__()
        self._buffer = ""

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        if isinstance(frame, LLMFullResponseStartFrame):
            self._buffer = ""
            await self.push_frame(frame, direction)
            return

        if isinstance(frame, LLMFullResponseEndFrame):
            if self._buffer:
                await self._flush(final=True)
            await self.push_frame(frame, direction)
            return

        if not isinstance(frame, LLMTextFrame):
            await self.push_frame(frame, direction)
            return

        self._buffer += frame.text
        await self._flush(final=False)

    async def _flush(self, final: bool) -> None:
        """Extract and dispatch any complete tags, then push whatever text
        is safe to speak. Holds back the whole buffer while a tag is open
        but not yet closed (the JSON body can be long and span many
        streamed chunks); otherwise holds back only a short trailing
        window so a fresh "<function=" opening isn't split across pushes.
        """
        cleaned = self._buffer
        for match in _TAG_PATTERN.finditer(self._buffer):
            name, raw_args = match.group(1), match.group(2)
            logger.warning(
                f"Stripped leaked tool-call tag from spoken output: {name}({raw_args})"
            )
            cleaned = cleaned.replace(match.group(0), "", 1)
            await self._dispatch(name, raw_args)

        opener_at = cleaned.find(_TAG_OPENER)
        if final:
            self._buffer = ""
            speakable, holdback = cleaned, ""
        elif opener_at != -1 and len(cleaned) - opener_at < _MAX_HOLD_CHARS:
            # An opener has started (name and/or closing ">" may not have
            # streamed in yet) and no matching close was found above - hold
            # back everything from the opener onward; whatever preceded it
            # is unrelated text and safe to speak now.
            speakable, holdback = cleaned[:opener_at], cleaned[opener_at:]
            self._buffer = holdback
        else:
            # No opener pending. Hold back only the exact trailing fragment
            # (if any) that could still grow into "<function=" as more text
            # streams in - not a fixed window, since that would let earlier
            # parts of the opener leak through once the fragment grows past it.
            cut = len(cleaned) - _partial_opener_suffix_len(cleaned)
            speakable, holdback = cleaned[:cut], cleaned[cut:]
            self._buffer = holdback

        if speakable:
            await self.push_frame(LLMTextFrame(speakable))

    async def _dispatch(self, name: str, raw_args: str) -> None:
        handler = HANDLERS.get(name)
        if handler is None:
            logger.error(f"Leaked tool-call tag referenced unknown tool: {name}")
            return
        try:
            arguments = json.loads(raw_args)
        except json.JSONDecodeError as exc:
            logger.error(f"Could not parse leaked tool-call arguments for {name}: {exc}")
            return
        try:
            await handler(_FakeFunctionCallParams(arguments).as_params())
        except Exception as exc:  # noqa: BLE001 - never let a recovery path crash the pipeline
            logger.error(f"Leaked tool-call recovery dispatch failed for {name}: {exc}")
