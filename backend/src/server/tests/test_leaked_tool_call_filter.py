"""Tests for the leaked-tool-call safety net (tools/leaked_tool_call_filter.py).

Verifies the exact failure mode seen in a real transcript: Groq's
llama-3.3-70b-versatile leaking a real tool call as literal
`<function=name>{json}</function>` text instead of firing it through
pipecat's normal structured tool-call path.
"""

import sys
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pipecat.frames.frames import (  # noqa: E402
    Frame,
    LLMFullResponseEndFrame,
    LLMFullResponseStartFrame,
    LLMTextFrame,
)
from pipecat.processors.frame_processor import FrameDirection  # noqa: E402

from tools.leaked_tool_call_filter import LeakedToolCallFilter  # noqa: E402


class CollectingFilter(LeakedToolCallFilter):
    """Captures every frame pushed downstream instead of forwarding it
    through a real pipeline link, so tests can assert on exactly what
    would have reached TTS."""

    def __init__(self):
        super().__init__()
        self.pushed: list[Frame] = []

    async def push_frame(self, frame, direction=FrameDirection.DOWNSTREAM):
        self.pushed.append(frame)


def spoken_text(filt: CollectingFilter) -> str:
    return "".join(f.text for f in filt.pushed if isinstance(f, LLMTextFrame))


async def run_turn(filt: CollectingFilter, chunks: list[str]):
    await filt.process_frame(LLMFullResponseStartFrame(), FrameDirection.DOWNSTREAM)
    for chunk in chunks:
        await filt.process_frame(LLMTextFrame(chunk), FrameDirection.DOWNSTREAM)
    await filt.process_frame(LLMFullResponseEndFrame(), FrameDirection.DOWNSTREAM)


@pytest.mark.asyncio
async def test_strips_leaked_tag_delivered_as_one_chunk():
    filt = CollectingFilter()
    tag = '<function=create_lead>{"name": "Chandra", "phone": "not provided"}</function>'
    text = f"Could you share your phone number? {tag}"

    with patch("tools.leaked_tool_call_filter.HANDLERS", {"create_lead": AsyncMock()}) as handlers:
        await run_turn(filt, [text])

    assert "function=" not in spoken_text(filt)
    assert "Could you share your phone number?" in spoken_text(filt)
    handlers["create_lead"].assert_awaited_once()
    call_args = handlers["create_lead"].call_args[0][0]
    assert call_args.arguments == {"name": "Chandra", "phone": "not provided"}


@pytest.mark.asyncio
async def test_strips_leaked_tag_split_across_many_small_chunks():
    """Real streaming delivers a handful of characters per chunk - the tag
    must still be detected when split across many process_frame calls."""
    filt = CollectingFilter()
    tag = '<function=update_lead>{"leadId": "lead-1", "notes": "wants ML course"}</function>'
    full_text = f"Great, thanks for that. {tag} Anything else?"
    chunks = [full_text[i : i + 3] for i in range(0, len(full_text), 3)]

    with patch("tools.leaked_tool_call_filter.HANDLERS", {"update_lead": AsyncMock()}) as handlers:
        await run_turn(filt, chunks)

    result = spoken_text(filt)
    assert "function=" not in result
    assert "Great, thanks for that." in result
    assert "Anything else?" in result
    handlers["update_lead"].assert_awaited_once()


@pytest.mark.asyncio
async def test_normal_response_with_no_tag_passes_through_unmodified():
    filt = CollectingFilter()
    text = "Sure! Our Data Science course covers Python, statistics, and ML fundamentals."

    with patch("tools.leaked_tool_call_filter.HANDLERS", {}):
        await run_turn(filt, [text])

    assert spoken_text(filt) == text


@pytest.mark.asyncio
async def test_unknown_tool_name_is_stripped_but_does_not_crash():
    filt = CollectingFilter()
    tag = '<function=not_a_real_tool>{"x": 1}</function>'

    with patch("tools.leaked_tool_call_filter.HANDLERS", {}):
        await run_turn(filt, [f"Okay. {tag}"])

    assert "function=" not in spoken_text(filt)
    assert "Okay." in spoken_text(filt)


@pytest.mark.asyncio
async def test_malformed_json_in_tag_is_stripped_but_does_not_crash():
    filt = CollectingFilter()
    tag = "<function=create_lead>{not valid json}</function>"

    with patch("tools.leaked_tool_call_filter.HANDLERS", {"create_lead": AsyncMock()}) as handlers:
        await run_turn(filt, [f"One moment. {tag}"])

    assert "function=" not in spoken_text(filt)
    handlers["create_lead"].assert_not_awaited()


@pytest.mark.asyncio
async def test_never_closing_opener_flushes_at_the_safety_cap():
    """A "<function=" that never gets a closing tag (malformed/truncated,
    not just slow to stream in) must eventually flush rather than silently
    swallowing the rest of the turn forever."""
    from tools import leaked_tool_call_filter as module

    filt = CollectingFilter()
    with (
        patch.object(module, "_MAX_HOLD_CHARS", 50),
        patch("tools.leaked_tool_call_filter.HANDLERS", {}),
    ):
        await filt.process_frame(LLMFullResponseStartFrame(), FrameDirection.DOWNSTREAM)
        await filt.process_frame(
            LLMTextFrame("<function=create_lead>{" + "x" * 60), FrameDirection.DOWNSTREAM
        )

    assert "<function=" in spoken_text(filt)


@pytest.mark.asyncio
async def test_low_latency_text_without_a_tag_is_not_held_back_indefinitely():
    """Only a short trailing holdback window should ever be withheld from a
    tag-free response - most of it must flush immediately per chunk, or the
    turn-detection latency work from the prior session is undone."""
    filt = CollectingFilter()
    await filt.process_frame(LLMFullResponseStartFrame(), FrameDirection.DOWNSTREAM)
    await filt.process_frame(LLMTextFrame("Hello there, welcome to the call!"), FrameDirection.DOWNSTREAM)

    # Before LLMFullResponseEndFrame, only a small trailing window is withheld.
    assert len(spoken_text(filt)) >= len("Hello there, welcome to the call!") - 15

    await filt.process_frame(LLMFullResponseEndFrame(), FrameDirection.DOWNSTREAM)
    assert spoken_text(filt) == "Hello there, welcome to the call!"
