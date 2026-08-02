"""Tests for tools/leads.py's LLM-invoked tool handlers.

Mocks tools.api_client.request (the single function every handler funnels
through) rather than the underlying httpx client, since that's the actual
seam these handlers depend on.
"""

import sys
from pathlib import Path
from typing import cast
from unittest.mock import AsyncMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pipecat.services.llm_service import FunctionCallParams  # noqa: E402

import tools.leads as leads  # noqa: E402
from tools.api_client import CrmApiError  # noqa: E402


class FakeParams:
    """Minimal stand-in for pipecat's FunctionCallParams - the handlers
    under test only ever touch .arguments and .result_callback. Kept
    untyped (not cast to FunctionCallParams) so tests can freely assert on
    .result_callback's AsyncMock methods; call sites cast it to
    FunctionCallParams only when passing it into a handler."""

    def __init__(self, arguments: dict):
        self.arguments = arguments
        self.result_callback = AsyncMock()

    def as_params(self) -> FunctionCallParams:
        return cast(FunctionCallParams, self)


@pytest.fixture(autouse=True)
def reset_module_state():
    leads.current_lead_id = None
    leads.call_summary_finalized = False
    yield


@pytest.mark.asyncio
async def test_create_lead_success():
    params = FakeParams({"name": "Jane", "phone": "+911234567890", "courseInterested": "AI"})
    with patch("tools.leads.request", new=AsyncMock(return_value={"id": "lead-1"})) as mock_request:
        await leads.create_lead(params.as_params())

    mock_request.assert_awaited_once_with("POST", "/api/leads", json=params.arguments)
    assert leads.current_lead_id == "lead-1"
    params.result_callback.assert_awaited_once_with({"leadId": "lead-1", "status": "created"})


@pytest.mark.asyncio
async def test_create_lead_handles_api_error_gracefully():
    params = FakeParams({"name": "Jane", "phone": "+911234567890", "courseInterested": "AI"})
    with patch("tools.leads.request", new=AsyncMock(side_effect=CrmApiError("boom"))):
        await leads.create_lead(params.as_params())

    params.result_callback.assert_awaited_once()
    result = params.result_callback.call_args[0][0]
    assert result["status"] == "error"


@pytest.mark.asyncio
async def test_update_lead_is_fire_and_forget():
    """update_lead must respond immediately (optimistic status) rather than
    waiting on the CRM API call - that's the whole point of it being
    fire-and-forget."""
    params = FakeParams({"leadId": "lead-1", "notes": "some note"})
    request_mock = AsyncMock(return_value={})
    with patch("tools.leads.request", new=request_mock):
        await leads.update_lead(params.as_params())

    params.result_callback.assert_awaited_once_with({"status": "updating"})
    # Give the background task a chance to run before asserting on it.
    import asyncio

    await asyncio.sleep(0)
    request_mock.assert_awaited_once_with("PATCH", "/api/leads/lead-1", json={"notes": "some note"})


@pytest.mark.asyncio
async def test_update_lead_missing_lead_id():
    params = FakeParams({"notes": "some note"})
    await leads.update_lead(params.as_params())
    params.result_callback.assert_awaited_once_with({"status": "error", "message": "Missing leadId"})


@pytest.mark.asyncio
async def test_schedule_callback_success():
    params = FakeParams({"leadId": "lead-1", "callbackTime": "2026-01-01T10:00:00Z", "notes": "call back"})
    with patch("tools.leads.request", new=AsyncMock(return_value={})) as mock_request:
        await leads.schedule_callback(params.as_params())

    mock_request.assert_awaited_once_with(
        "POST",
        "/api/leads/lead-1/callback",
        json={"callbackTime": "2026-01-01T10:00:00Z", "notes": "call back"},
    )
    params.result_callback.assert_awaited_once_with({"status": "scheduled"})


@pytest.mark.asyncio
async def test_schedule_callback_handles_api_error():
    params = FakeParams({"leadId": "lead-1", "callbackTime": "2026-01-01T10:00:00Z"})
    with patch("tools.leads.request", new=AsyncMock(side_effect=CrmApiError("boom"))):
        await leads.schedule_callback(params.as_params())

    params.result_callback.assert_awaited_once()
    assert params.result_callback.call_args[0][0]["status"] == "error"


@pytest.mark.asyncio
async def test_request_human_escalation_assigned():
    params = FakeParams({"leadId": "lead-1", "reason": "refund_dispute", "summary": "wants a refund"})
    with patch(
        "tools.leads.request",
        new=AsyncMock(return_value={"status": "assigned", "assignedEmployee": {"id": "emp-1"}}),
    ) as mock_request:
        await leads.request_human_escalation(params.as_params())

    mock_request.assert_awaited_once_with(
        "POST",
        "/api/escalations",
        json={"leadId": "lead-1", "reason": "refund_dispute", "summary": "wants a refund"},
    )
    result = params.result_callback.call_args[0][0]
    assert result["status"] == "assigned"


@pytest.mark.asyncio
async def test_request_human_escalation_queued():
    params = FakeParams({"leadId": "lead-1", "reason": "complaint", "summary": "angry caller"})
    with patch("tools.leads.request", new=AsyncMock(return_value={"status": "queued"})):
        await leads.request_human_escalation(params.as_params())

    result = params.result_callback.call_args[0][0]
    assert result["status"] == "queued"
    assert "busy" in result["message"]


@pytest.mark.asyncio
async def test_request_human_escalation_handles_api_error_gracefully():
    params = FakeParams({"leadId": "lead-1", "reason": "complaint", "summary": "angry caller"})
    with patch("tools.leads.request", new=AsyncMock(side_effect=CrmApiError("boom"))):
        await leads.request_human_escalation(params.as_params())

    result = params.result_callback.call_args[0][0]
    assert result["status"] == "error"


@pytest.mark.asyncio
async def test_finalize_call_summary_sets_flag_and_logs():
    params = FakeParams(
        {
            "leadId": "lead-1",
            "shortSummary": "Interested in AI course",
            "goals": "career switch",
        }
    )
    with patch("tools.leads.request", new=AsyncMock(return_value={})) as mock_request:
        await leads.finalize_call_summary(params.as_params())

    assert leads.call_summary_finalized is True
    mock_request.assert_awaited_once()
    call_args = mock_request.call_args
    assert call_args[0][0] == "POST"
    assert call_args[0][1] == "/api/calls"
    assert call_args[1]["json"]["leadId"] == "lead-1"
    assert call_args[1]["json"]["shortSummary"] == "Interested in AI course"
    assert call_args[1]["json"]["goals"] == "career switch"
    params.result_callback.assert_awaited_once_with({"status": "logged"})


@pytest.mark.asyncio
async def test_finalize_call_summary_missing_lead_id():
    params = FakeParams({"shortSummary": "test"})
    await leads.finalize_call_summary(params.as_params())
    assert leads.call_summary_finalized is False
    params.result_callback.assert_awaited_once_with({"status": "error", "message": "Missing leadId"})


@pytest.mark.asyncio
async def test_log_call_summary_handles_api_error_without_raising():
    """log_call_summary is called directly (not via a tool result_callback) -
    it must never raise into the pipeline, only log."""
    with patch("tools.leads.request", new=AsyncMock(side_effect=CrmApiError("boom"))):
        await leads.log_call_summary(lead_id="lead-1", call_type="AI_INBOUND")
    # No assertion needed beyond "didn't raise" - that's the contract.
