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
  PostgreSQL, hosted on Neon). Owns all persistence: Leads, Calls,
  Employees, Escalations. Exposes REST endpoints under `/api/*`. Two auth
  modes: JWT (`Authorization: Bearer`) for human/employee-facing routes with
  role checks (ADMIN/MANAGER/SALES_EMPLOYEE), and a shared service key
  (`X-Service-Key`) for the Python voice agent's backend-to-backend calls.
  Round-robin human escalation assignment uses a Postgres
  `FOR UPDATE SKIP LOCKED` query, scoped to `role = 'SALES_EMPLOYEE' AND
  status = 'ACTIVE'`, so concurrent escalations can't double-assign the same
  employee, can't starve anyone, and never assign to Admin/Manager accounts.
  Verified running end-to-end against the real database (migrations,
  seed, live HTTP + live voice-call round-trip) as of 2026-08-02.
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

### 2026-08-02 — Phase 2a: bug fixes + verified CRM backend + schema prep

**Context:** After the Foundation phase, the user hit three concrete problems
using the voice agent: LLM function calls were visible in the console/UI,
the agent lagged noticeably, and it was unclear whether tool calls actually
reached the CRM API (they never had — see key mismatch below). The user also
confirmed they want the full original platform (dashboards, analytics,
real-time, expanded tools), but agreed to sequence it — this phase fixes the
concrete bugs and gets the backend verified and running for real against a
live database; frontend/dashboards/analytics/real-time are tracked as an
explicit roadmap below rather than attempted in one pass.

**Fixed:**
- **Function calls visible in console/UI** — `backend/src/server/bot.py`'s
  `PipelineWorker(...)` call passed no `rtvi_observer_params`, so Pipecat's
  auto-created RTVI observer emitted function-call lifecycle events (start/
  in-progress/stopped) at the default `NONE` report level — visible to any
  RTVI-aware client even without function name/args. Fixed by passing
  `rtvi_observer_params=RTVIObserverParams(function_call_report_level={"*":
  RTVIFunctionCallReportLevel.DISABLED})`.
- **Agent latency** — `backend/src/server/tools/api_client.py` opened a
  brand-new `httpx.AsyncClient` (fresh TCP/TLS handshake) on every tool
  call; replaced with a lazily-created, reused module-level client (tighter
  split timeouts: connect 3s/read 5s vs. a flat 10s) with an `aclose_client()`
  hook wired into `bot.py`'s `run_bot` shutdown path. `update_lead`
  (`tools/leads.py`) is now fire-and-forget — the LLM never reads its result
  back into the conversation, so the write happens via `asyncio.create_task`
  instead of blocking the turn; `create_lead`, `schedule_callback`, and
  `request_human_escalation` stay blocking since their result changes what
  the LLM says next. `update_lead`'s schema was also widened to accept
  `status` and `leadScore` (folding in `markLeadInterested`/`markLeadLost`/
  `updateLeadStatus` from the original spec's function list rather than
  adding separate tools).
- **CRM_SERVICE_API_KEY/SERVICE_API_KEY mismatch** — the bot's `.env` had
  `CRM_SERVICE_API_KEY` empty while the API's `.env` had a real
  `SERVICE_API_KEY` — every tool call was failing auth silently. Synced.
- **`backend/api/package.json` regression** — `"start"` script referenced
  `dist/server.ts` (invalid, Node can't run `.ts` directly); reverted to
  `dist/server.js`.
- **Round-robin role-scoping bug** (found during live verification, not in
  the original bug list) — the assignment query filtered only on
  `status = 'ACTIVE'`, not role, so it could assign an escalation to the
  seeded Admin account (which is also `status: ACTIVE`) instead of only
  Sales Employees. Fixed by adding `AND role = 'SALES_EMPLOYEE'` to the
  `SELECT ... FOR UPDATE SKIP LOCKED` query in `escalationService.ts`.

**Schema (one additive migration, `20260802115925_init` — this is the first
migration in the repo; a prior untracked migration had been applied directly
to the Neon database in an earlier session with no local migration file, and
was reset since all tables were empty):**
- `Lead.leadScore` converted from free-text `String?` to enum `LeadScore`
  (`HOT`/`WARM`/`COLD`/`VERY_HOT`/`LOST`/`DORMANT`/`RE_ENGAGE`) — matches the
  original spec's scoring taxonomy exactly and lets future automation branch
  on a closed set. `update_lead`'s tool schema and the API's zod
  `updateLeadSchema` updated to match.
- `Call.transcript` (nullable `@db.Text`) added — unpopulated until a
  transcript processor is wired into the pipeline (see Roadmap, Phase 2e).
  `Call.recordingUrl` already existed from the Foundation phase.
- Still deferred, no change: `Lead.tags`/`metadata` JSON blobs, distinct
  `location`/`preferredMode` columns, `customerStage` (no concrete consumer
  yet; `customerStage`'s meaning relative to the existing `LeadStatus` enum
  needs to be pinned down when a dashboard screen actually needs it, not
  guessed now).

**Verified end-to-end (not just code review):**
- `backend/api` migrated and seeded against the real Neon Postgres instance
  (1 ADMIN + 3 ACTIVE + 1 ON_LEAVE `SALES_EMPLOYEE`, per `prisma/seed.ts`).
- Live HTTP round-trip tested: login → JWT, lead create/list/patch (incl.
  the new `leadScore` enum), call logging, and round-robin escalation —
  sequential escalations correctly cycled Employee One → Two → Three,
  never the Admin (post-fix) and never the ON_LEAVE employee.
- Live voice call end-to-end: a real conversation created a real `Lead` row
  via `create_lead`, and a follow-up `update_lead` call landed a `leadScore`
  and `notes` update — confirmed via `GET /api/leads`. Test/demo rows were
  cleared afterward; seeded employees left intact.

**Known limitation, deferred to Phase 2f (not fixed this session, by
explicit user decision):** under genuinely concurrent escalation requests
(3 fired simultaneously in testing), 2 of 3 failed with Prisma error P2028
("Unable to start a transaction in the given time") against Neon's pooled
connection string — likely the pgbouncer-style pooler not playing well with
Prisma's interactive `$transaction` under concurrent load. Sequential
requests and light concurrency work correctly; this only surfaced under
harder concurrent load than the Foundation-phase testing exercised. Needs
proper investigation (e.g. a direct/non-pooled connection string for
transactions, or Prisma connection-limit tuning) as part of Phase 2f
hardening, not a quick patch now.

**Roadmap (user confirmed wanting the full platform; sequenced rather than
attempted in one pass):**
- **Phase 2b:** Frontend bootstrap — migrate `frontend/` to TypeScript, add
  React Router, React Query, Tailwind, JWT auth (httpOnly cookie), employee
  login + "my assigned leads" list + lead detail view.
- **Phase 2c:** Admin dashboard (all-leads view, employee management,
  escalation queue) + analytics/chart pages (lead pipeline, conversion rate,
  source distribution, sentiment trends, course interest distribution, call
  duration, follow-up success, revenue forecast placeholder).
- **Phase 2d:** Real-time layer — Socket.IO server in `backend/api`,
  room-scoped events (`employee:{id}`, `role:admin`) emitted from
  `escalationService`/`leadService`/`callService` mutation points; frontend
  subscribes and invalidates React Query caches.
- **Phase 2e:** Expanded tool-calling set + lead-scoring automation. Most of
  the original spec's function list (`assignEmployee`, `saveTranscript`,
  `getEmployeeAvailability`, `searchLead`, `fetchLeadHistory`,
  `sendNotification`) is backend/dashboard-side logic, never LLM-invoked —
  `updateLeadStatus`/`markLeadInterested`/`markLeadLost` already folded into
  `update_lead` this phase. `getCourseInformation`/`getPricing` stay out of
  tool-calling (static KB; pricing is an explicit human-escalation trigger
  by design) unless the business wants dynamic/admin-editable pricing later.
  This phase wires a transcript processor into the pipeline (to populate
  `Call.transcript`) and richer call-summary fields (goals/pain points/next
  steps/buying signals/objections/recommended action).
- **Phase 2f:** Hardening — the Neon transaction-pooling issue above, secret
  rotation (current `JWT_SECRET`/`SERVICE_API_KEY` are simple placeholders,
  fine for local dev, not for production), rate limiting, input
  sanitization audit, test coverage, CI.
