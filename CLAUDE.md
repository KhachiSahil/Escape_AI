# CLAUDE.md — Change Log & Architecture Notes

This file tracks architecturally significant changes made to this repository
by Claude, in date order. Append a new dated entry per work session rather
than rewriting history.

## Current Architecture

- **`backend/src/server/`** — Python 3.11 Pipecat voice agent. Entry point
  `bot.py` wires Deepgram STT → Groq LLM → ElevenLabs TTS over a WebRTC
  transport. System prompt/knowledge base in `prompts.py`. LLM tool-calling
  functions in `tools/` — these call the CRM API over HTTP rather than
  touching any database directly (the Python process has no DB of its own).
- **`backend/api/`** — Node.js/TypeScript CRM API (Express + Prisma +
  PostgreSQL). Owns all persistence: Leads, Calls, Employees, Escalations.
  Exposes REST endpoints under `/api/*`. Two auth modes: JWT
  (`Authorization: Bearer`) for human/employee-facing routes with
  role checks (ADMIN/MANAGER/SALES_EMPLOYEE), and a shared service key
  (`X-Service-Key`) for the Python voice agent's backend-to-backend calls.
  Round-robin human escalation assignment uses a Postgres
  `FOR UPDATE SKIP LOCKED` query so concurrent escalations can't
  double-assign the same employee or starve anyone.
- **`frontend/`** — Stock Vite + React 19 template, not yet built out. No
  dashboard UI exists yet (see Deferred below).

## Change Log

### 2026-07-31 — Foundation phase: EdTech domain rewrite + CRM backend

**Context:** Project pivoted from a travel-agency voice agent
("TravelHangouts") to an EdTech AI voice sales agent. Full scope requested
was a complete Enterprise AI Sales Platform (CRM dashboards, analytics,
real-time updates, the works); this pass was explicitly scoped down to
"Foundation first" — domain rewrite + real backend + persistence + a
concurrency-safe round-robin escalation mechanism, with dashboard UI and
analytics deferred to a later phase.

**Removed (travel domain):**
- `backend/src/server/prompts.py` — `TRAVEL_KNOWLEDGE_BASE` / TravelHangouts
  persona, replaced with an EdTech knowledge base + sales-counselor persona.
- `backend/src/server/tools/tickets.py` — deleted. Was the only travel tool
  (`create_followup`, backed by an in-memory mock dict). Dangling prompt
  references to unimplemented `create_enquiry`/`get_booking_status`/
  `get_enquiry_status` tools are also gone (they never existed in code).

**Added (EdTech voice agent):**
- `backend/src/server/prompts.py` — rewritten: EdTech knowledge base
  (courses, enrollment, pricing/refund/placement policy — placeholder
  values, business to fill in real figures) + a persona instructed to
  qualify leads, detect intent/urgency, never drift off-topic, never
  hallucinate pricing/policy, and hand off to a human immediately on
  pricing negotiation, refund disputes, complaints, complex admissions,
  scholarships, payment failure, parent/counselor requests, or repeated
  human requests.
- `backend/src/server/tools/api_client.py` — thin async `httpx` client to
  the CRM API, authenticated via `X-Service-Key`.
- `backend/src/server/tools/leads.py` — `create_lead`, `update_lead`,
  `schedule_callback`, `request_human_escalation` (LLM-callable tools) and
  `log_call_summary` (called directly from `bot.py` on disconnect, not
  LLM-invoked).
- `backend/src/server/tools/__init__.py` — updated tool registry to the
  above.
- `backend/src/server/config.py` / `.env.example` — added
  `CRM_API_BASE_URL`, `CRM_SERVICE_API_KEY`.
- `backend/src/server/bot.py` — `on_client_disconnected` now calls
  `log_call_summary` if a lead was created during the session. No pipeline/
  transport changes.
- `backend/src/server/pyproject.toml` — added `httpx` dependency.

**Added (CRM backend — new service, `backend/api/`):**
- Node.js/TypeScript + Express + Prisma + PostgreSQL, chosen to pair with a
  future React/TS dashboard frontend. Lives as a sibling to
  `backend/src/server` under the `backend/` umbrella; separate
  `package.json`/`.gitignore`/deploy from the Python agent.
- Prisma schema (`prisma/schema.prisma`): `Employee`, `Lead`, `Call`,
  `Escalation` models. Deliberately excludes speculative fields with no
  current consumer (conversation transcript storage, `tags`/`metadata` JSON
  blobs, separate `location`/`languagePreference` columns) — flagged as
  easy fast-follow migrations once a UI actually needs them, not built
  speculatively now.
- REST API (`src/routes/`): `/api/auth/login`, `/api/leads` (CRUD +
  `/callback`), `/api/calls`, `/api/escalations`, `/api/employees` (+
  status toggle for testing round-robin skip behavior).
- Auth (`src/middleware/auth.ts`): JWT-based for employee/admin routes with
  role checks; shared service key for the Python agent's calls.
- Round-robin escalation assignment (`src/services/escalationService.ts`):
  `SELECT ... FOR UPDATE SKIP LOCKED` ordered by `lastAssignedAt ASC NULLS
  FIRST`, scoped to `status = 'ACTIVE'` employees, inside one
  `prisma.$transaction` alongside the Escalation row creation and Lead
  update. If no employee is available, the Escalation is created with
  `status: "queued"` rather than failing.
- `prisma/seed.ts` — seeds 1 ADMIN + 3 ACTIVE + 1 ON_LEAVE employee for
  manually verifying round-robin fairness and leave-skipping.

**Deferred (explicitly out of scope this phase):**
- Dashboard UI (employee CRM view, admin analytics) — `frontend/` untouched.
- Analytics/charts, conversion funnel, performance dashboards.
- WebSocket/real-time push (no frontend consumer exists yet).
- Conversation transcript capture (Pipecat's transcript processor isn't
  wired into `bot.py`'s pipeline yet — call summaries are captured, full
  transcripts are not).
- `tags`/`metadata` JSON fields on Lead, and narrow columns like
  `preferredMode`/`location` — no consumer yet, added speculatively would
  violate the project's anti-overengineering guidance.
- Multi-role UI permission enforcement beyond API-level JWT role checks
  (there's no UI yet to enforce it in).

**Open items for the business/user to resolve:**
- Real pricing, EMI, refund, and placement-guarantee copy for the EdTech
  knowledge base (currently bracketed placeholders, matching how the
  original travel KB handled unfilled business specifics).
- Where PostgreSQL runs for this phase (local/Docker/managed) — `.env.example`
  assumes a local/Docker Postgres reachable via `DATABASE_URL`.
