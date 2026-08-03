"""Thin async HTTP client for the CRM API (backend/api).

The Python voice agent has no database of its own. Every tool that needs to
create or update a Lead/Call/Escalation makes a real HTTP call to the Node/TS
CRM API using a shared service key (not a user JWT — this is a trusted
backend-to-backend call, not a human session).

A single client is reused across calls (rather than opening a fresh
connection per request) since tool calls happen inline in the conversation
turn and per-call TCP/TLS handshake overhead directly adds to voice latency.
"""

import httpx
from loguru import logger

import config


class CrmApiError(Exception):
    """Raised when the CRM API returns an error response."""


_client: httpx.AsyncClient | None = None


def get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(
            # Read/write generous enough to survive a cold Neon compute
            # resuming from auto-suspend on the CRM API's first query after
            # idle (observed to take several seconds) - a tight timeout here
            # surfaces as a silent, hard-to-diagnose "write failed" with no
            # indication the database was merely waking up.
            timeout=httpx.Timeout(connect=5.0, read=15.0, write=15.0, pool=5.0),
            limits=httpx.Limits(max_keepalive_connections=10, max_connections=20),
        )
    return _client


async def aclose_client() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


async def request(method: str, path: str, json: dict | None = None) -> dict:
    url = f"{config.CRM_API_BASE_URL}{path}"
    headers = {"X-Service-Key": config.CRM_SERVICE_API_KEY or ""}
    client = get_client()

    try:
        response = await client.request(method, url, json=json, headers=headers)
        response.raise_for_status()
        return response.json() if response.content else {}
    except httpx.HTTPStatusError as exc:
        logger.error(f"CRM API error {exc.response.status_code} on {method} {path}: {exc.response.text}")
        raise CrmApiError(f"CRM API returned {exc.response.status_code}") from exc
    except httpx.HTTPError as exc:
        logger.error(f"CRM API request failed on {method} {path}: {exc}")
        raise CrmApiError("CRM API request failed") from exc
