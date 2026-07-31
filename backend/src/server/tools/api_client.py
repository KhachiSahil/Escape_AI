"""Thin async HTTP client for the CRM API (backend/api).

The Python voice agent has no database of its own. Every tool that needs to
create or update a Lead/Call/Escalation makes a real HTTP call to the Node/TS
CRM API using a shared service key (not a user JWT — this is a trusted
backend-to-backend call, not a human session).
"""

import httpx
from loguru import logger

import config


class CrmApiError(Exception):
    """Raised when the CRM API returns an error response."""


async def request(method: str, path: str, json: dict | None = None) -> dict:
    url = f"{config.CRM_API_BASE_URL}{path}"
    headers = {"X-Service-Key": config.CRM_SERVICE_API_KEY or ""}

    async with httpx.AsyncClient(timeout=10.0) as client:
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
