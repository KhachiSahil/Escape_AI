# CLAUDE.md — Change Log & Architecture Notes

This file tracks architecturally significant changes made to this repository
by Claude, in date order. Append a new dated entry per work session rather
than rewriting history.

## Current Architecture

- **`backend/src/server/`** — Python 3.11 Pipecat voice agent. Entry point
  `bot.py` wires Deepgram STT → Groq LLM → ElevenLabs TTS over either a
  WebRTC transport (`SmallWebRTCRunnerArguments`) or a telephony transport
  (`WebSocketRunnerArguments`, via `pipecat.runner.utils.create_transport` —
  covers Twilio and any other provider Pipecat auto-detects from the Media
  Streams handshake; see Phase 2h). System prompt/knowledge base in
  `prompts.py`. LLM tool-calling functions in `tools/` — these call the CRM
  API over HTTP rather than touching any database directly (the Python
  process has no DB of its own). `tools/outbound.py` +
  `trigger_outbound_call.py` originate outbound Twilio calls via the Twilio
  REST SDK — not LLM-invoked, a separate application concern from the
  in-conversation tool-calling flow.
- **`backend/api/`** — Node.js/TypeScript CRM API (Express + Prisma +
  PostgreSQL, hosted on Neon — non-pooled connection, see Phase 2f entry).
  Owns all persistence: Leads, Calls, Employees, Escalations. Exposes REST
  endpoints under `/api/*`. Two auth modes: JWT for human/employee-facing
  routes with role checks (ADMIN/MANAGER/SALES_EMPLOYEE) — read from an
  httpOnly cookie first, falling back to `Authorization: Bearer` — and a
  shared service key (`X-Service-Key`) for the Python voice agent's
  backend-to-backend calls. Login/logout/`GET /api/auth/me` manage the
  cookie session. Rate-limited (strict on login, moderate on JWT-protected
  routes, unthrottled for the trusted voice agent's service-key routes).
  Round-robin human escalation assignment uses a Postgres
  `FOR UPDATE SKIP LOCKED` query, scoped to `role = 'SALES_EMPLOYEE' AND
  status = 'ACTIVE'`, so concurrent escalations can't double-assign the same
  employee, can't starve anyone, and never assign to Admin/Manager accounts.
  A Socket.IO server (`src/realtime/socket.ts`) attached to the same HTTP
  server pushes `lead:updated`/`escalation:created`/`call:logged`/
  `presence:online`/`presence:offline` events to JWT-authenticated clients,
  room-scoped per employee (`employee:{id}`) and a shared `role:admin` room
  for ADMIN/MANAGER; an in-memory `Set` tracks currently-connected employee
  ids for presence (single-instance deployment only, see Phase 2h).
  `src/services/analyticsService.ts` + `/api/analytics/*` expose dashboard
  aggregates derived only from fields that actually exist in the schema (no
  fabricated revenue/missed-call metrics — see the 2c entry below).
  `src/services/scoringService.ts` computes `Lead.compositeScore` as a
  deterministic weighted average of six LLM-set 1-10 sub-scores (see Phase
  2h). `src/services/notificationService.ts` sends fire-and-forget SMTP
  email on escalation-assigned/lead-reassigned (never throws — an email
  outage can't break the mutation that triggered it).
  `src/services/auditService.ts` writes a fire-and-forget `AuditLog` entry
  from the same four mutation points that already emit socket events.
  Verified running end-to-end against the real database (migrations, seed,
  live HTTP + live voice-call round-trip) as of 2026-08-02.
- **`frontend/`** — React 19 + TypeScript CRM dashboard (Vite, React Router,
  React Query, Tailwind v4). Auth identity comes from an httpOnly cookie the
  browser attaches automatically (`credentials: 'include'`) — the frontend
  never touches the JWT directly, rehydrating who's logged in via
  `GET /api/auth/me` on mount. Shared `AppLayout` with role-aware nav wraps
  all authenticated routes.
  Employee-facing: `/leads` (own assigned leads for SALES_EMPLOYEE, all
  leads for ADMIN/MANAGER, with a score filter/sort), `/leads/:id` (call/
  escalation history, editable status/notes for the assigned employee or
  any admin/manager, a manual "log a call you handled" form, recording
  playback where `Call.recordingUrl` is populated, and a composite-score
  breakdown), `/calls` (Today / All time call list). Admin-only
  (`/admin/*`, role-gated): `/admin/employees` (list + status toggle +
  performance numbers + online/offline presence dot), `/admin/analytics`
  (charts using the `dataviz` skill's validated categorical palette +
  recharts), `/admin/escalations` (read-only queued-escalation visibility,
  ordered by lead priority), `/admin/audit-log` (read-only who-changed-what
  trail). A Socket.IO client (`useRealtimeSync`, mounted in `AppLayout`)
  invalidates the relevant React Query caches on `lead:updated`/
  `escalation:created`/`call:logged`/`presence:online`/`presence:offline`
  events pushed from the backend.

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
  `Escalation` models. `Lead.language` was added and wired through
  `update_lead`'s tool schema from this phase onward (the caller's spoken
  language preference, freeform e.g. "Hindi", "English") — not speculative,
  it has a real consumer. **[Corrected in Phase 2g]** an earlier version of
  this passage incorrectly listed `languagePreference` alongside `tags`/
  `metadata`/`location` as excluded — that was wrong, the field exists and
  is used. Deliberately excludes other speculative fields with no current
  consumer (conversation transcript storage, `tags`/`metadata` JSON blobs,
  a separate `location` column) — flagged as easy fast-follow migrations
  once a UI actually needs them, not built speculatively now.
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
  sanitization audit, test coverage, CI, and httpOnly-cookie auth (see 2b/2c
  entry below for why it was deferred rather than built alongside 2c/2d/2e).

### 2026-08-02 — Phases 2b–2e: full frontend, admin dashboard, real-time, richer summaries

**Context:** User asked to build the rest of the original platform spec in
one continuous session — frontend (2b), admin dashboard + analytics (2c),
real-time updates (2d), and expanded tools/richer call summaries (2e) —
sequenced but committed as separate milestones, plus pulling forward
cheap/high-value hardening while deferring rate limiting/test suites/CI to
Phase 2f.

**Hardening (landed first, before 2c):**
- **`PATCH /api/employees/:id/status` passwordHash leak** — was returning
  the full Prisma row (unlike the list endpoint, which already used
  `select`). Added the missing `select` clause.
- **SALES_EMPLOYEE couldn't edit their own assigned leads** —
  `PATCH /api/leads/:id` was ADMIN/MANAGER only. Changed to any
  authenticated role, with an ownership check in `leadService.updateLead`
  (employees can only update leads assigned to them, and can't reassign via
  the request body — that field is silently stripped for non-admin actors).
  Frontend's edit-gate on `LeadDetailPage` relaxed to match.
- **React ErrorBoundary** added at the app root (`main.tsx`) so a render
  crash shows a recoverable screen instead of a blank page.
- **httpOnly-cookie auth — explicitly NOT built**, deferred to Phase 2f.
  Would require `cookie-parser`, a CORS change from allow-all to an
  explicit origin + `credentials: true`, a `res.cookie` login response, a
  new logout endpoint, `middleware/auth.ts` reading cookies, every frontend
  fetch needing `credentials: 'include'`, and a more complex Socket.IO auth
  handshake (cookie auth doesn't fit the standard
  `socket.handshake.auth.token` pattern cleanly) — too much cross-cutting
  surface to land safely alongside 2c/2d/2e's scope, with the existing
  sessionStorage-JWT already working end-to-end.

**Phase 2b — Frontend bootstrap:**
- `frontend/` migrated from the stock Vite+React JS template to TypeScript
  (React Router, React Query, Tailwind v4 via `@tailwindcss/vite`).
- JWT auth: `AuthContext` (sessionStorage-persisted `{token, employee}`),
  a typed `fetch` wrapper (`lib/api.ts`) that attaches the bearer token and
  triggers logout on any 401, `RequireAuth` route guard (optional
  role-scoping).
- First real screens: login, assigned-leads list (role-scoped), lead detail
  (call/escalation history + edit form).

**Phase 2c — Admin dashboard + analytics:**
- New backend: `analyticsService.ts` + `GET /api/analytics/overview` +
  `GET /api/analytics/employee-performance` (ADMIN/MANAGER only), plus
  `GET /api/escalations?status=queued` extending the existing escalations
  router. Every metric is derived only from fields that actually exist:
  lead pipeline/source/course distribution, call duration, conversion rate
  (both a resolved-only and an overall formula, both labeled), sentiment
  distribution (labeled as data-quality-limited — `Call.sentiment` is
  free-text, not an enum, so near-duplicate values fragment), and a
  follow-up-success proxy metric (also labeled as an approximation).
  **Revenue forecast and missed-call metrics were deliberately omitted** —
  no deal-value field or call-attempt-outcome concept exists anywhere in
  the schema, and fabricating numbers for them would be worse than not
  having the chart.
- New frontend: shared `AppLayout` (role-aware nav, replaces the
  per-page header chrome from 2b), `/admin/employees` (list + status
  toggle + inline performance), `/admin/analytics` (charts via `recharts`,
  built following the `dataviz` skill's procedure — form-first, then the
  skill's validated categorical palette run through its CVD/contrast
  validator before use, not hand-picked colors), `/admin/escalations`
  (read-only queue view — no reassignment mutation yet, not needed until
  the page reveals it's actually wanted). Leads list also gained a
  score filter + sort-by-score toggle (the "lead scoring surfaced in
  dashboard" item from the 2a roadmap — no new backend scoring logic, just
  client-side sort/filter on already-fetched data).

**Phase 2d — Real-time layer:**
- Backend: `server.ts` restructured to attach Socket.IO to the same
  `http.Server` Express uses. JWT-authenticated handshake
  (`socket.handshake.auth.token`, same `jwt.verify`/secret as REST). Room
  design: `employee:{id}` per socket, plus a shared `role:admin` room for
  both ADMIN and MANAGER (matching every existing `requireAuth` check in
  this codebase, which already treats those two roles as one privilege
  tier — no precedent anywhere for splitting them, so this didn't either).
  Three mutation points emit events reusing exactly the REST response
  shapes (no new payload fields invented): `escalationService.createEscalation`
  → `escalation:created`, `leadService.updateLead` → `lead:updated`,
  `callService.createCall` → `call:logged`.
- Frontend: `lib/socket.ts` (module-level singleton, mirrors `lib/api.ts`'s
  token-tracking pattern) + `useRealtimeSync` (mounted once in `AppLayout`)
  invalidates the relevant React Query keys on each event — refetch rather
  than manually splicing the payload into the cache, simpler and
  self-correcting for this first real-time pass.
- Verified: a temporary `socket.io-client` test script confirmed both an
  admin session and the specific assigned employee's session receive a
  `lead:updated` event after a real `PATCH`.

**Phase 2e — Richer call summaries + `finalize_call_summary` tool:**
- Schema (additive migration `20260802165424_add_call_summary_fields`): 6
  new nullable `Call` columns — `goals`, `painPoints`, `nextSteps`,
  `buyingSignals`, `objections`, `recommendedAction` — free text, matching
  how `keyPoints`/`detailedSummary` are already modeled (no structured
  sub-schema forced onto LLM-generated prose).
- **Fixed a pre-existing gap while adding these**: `log_call_summary` was
  only ever called from `bot.py`'s `on_client_disconnected` with hardcoded
  `None` for every summary field — they were never actually populated by
  anything. Added `finalize_call_summary` as a new LLM-invoked tool
  (`tools/leads.py`, same `FunctionSchema` pattern as `create_lead`/
  `update_lead`) that the agent calls when it senses the conversation
  wrapping up, passing real values. The disconnect-time `log_call_summary`
  call is now an explicit fallback guarded by a `call_summary_finalized`
  flag — only fires if the LLM never got a chance to call the new tool
  (e.g. an abrupt disconnect), so a call record is still logged rather than
  lost entirely, just without the richer fields.
- `prompts.py` gained an "Ending the call" section instructing the agent to
  call `finalize_call_summary` once, honestly, before saying goodbye.
- **Transcript capture (originally scoped as part of 2e) was explicitly
  skipped this pass, by user decision** — the installed `pipecat_ai==1.3.0`
  has no `TranscriptProcessor` class anywhere in the package (confirmed by
  exhaustive search, not assumed); building one from scratch or upgrading
  pipecat was judged out of scope for this session. `Call.transcript`
  (added in Phase 2a) remains unpopulated. Revisit as its own focused task.
- Lead-scoring automation: no new backend logic, per the already-settled
  2a decision — see the 2c entry above for where this actually landed
  (frontend sort/filter).

**Bug found and fixed during 2c live verification (not in the original
plan):** none this round beyond what's listed above — the 2a session's
round-robin role-scoping bug was the one caught by live testing; this
round's curl/script verification at each milestone didn't surface new ones.

**Known limitations carried forward, unchanged:** the Neon transaction-pool
timeout under heavy concurrent load (2a entry) and httpOnly-cookie auth
(this entry) both remain deferred to Phase 2f.

**Verified this session:** every milestone's backend half was curl/script-
tested against the live Neon-backed API before its frontend counterpart was
built (analytics endpoints, escalation queue, Socket.IO event delivery via
a temporary test script, the 6 new Call fields via a direct POST). Frontend
builds/typechecks/lints clean at every milestone. Full interactive browser
verification (charts rendering, live cross-tab updates, a real voice call
exercising `finalize_call_summary`) is the user's to do at their own pace —
flagged here rather than claimed as done without having actually watched it
happen.

### 2026-08-02 — Phase 2f: hardening (all six items)

**Context:** All six items the Phase 2a/2c-2e roadmap deferred to
"hardening" — the Neon P2028 transaction-pool bug, rate limiting, an input
sanitization audit, test coverage + CI, httpOnly-cookie auth, and secret
rotation. Built and verified milestone-by-milestone, one commit per
milestone, same pattern as 2b-2e.

**1. Secret rotation:** `JWT_SECRET` and `SERVICE_API_KEY` were both the
literal placeholder `sahil_vanshaj` — a JWT-signing secret and a
service-to-service key are different trust boundaries and must never share
a value. Rotated both to independent 32-byte random values; synced
`backend/src/server/.env`'s `CRM_SERVICE_API_KEY` to match. Rotating
`JWT_SECRET` invalidated every previously-issued JWT (expected, stated
explicitly, not silently done).

**2. Neon P2028 fix — resolved and verified:** `directUrl` in Prisma only
affects Migrate/introspection, never the runtime query engine — confirmed
this before assuming it would fix anything. The actual fix was moving
runtime `DATABASE_URL` off Neon's pooled (`-pooler`) endpoint to the direct
one (Neon's documented convention: strip `-pooler` from the hostname) —
pgbouncer's transaction-pooling mode was the root cause of the interactive
`$transaction` (`FOR UPDATE SKIP LOCKED` + update) timing out under
concurrent load. Also added `DIRECT_URL`/`directUrl` for Migrate hygiene,
and explicit `{maxWait: 5000, timeout: 10000}` options on the
`$transaction` call as cheap insurance. **Verified by reproducing the exact
Phase 2a test**: 3 simultaneous `POST /api/escalations` against 3 leads
with 3 ACTIVE employees — all 3 succeeded with no P2028 (previously 2 of 3
failed).

**3. Rate limiting:** `express-rate-limit`, two tiers — `loginLimiter`
(5/min/IP on `POST /api/auth/login` only) and `humanRouteLimiter`
(100/min/IP, attached per-route to every JWT-protected human/dashboard
route). Service-key routes (used by the trusted voice agent) are
deliberately unthrottled — attaching limiters per-route rather than
globally means they're naturally excluded rather than needing a runtime
skip check. Verified: 6th rapid login attempt gets 429; 8 rapid service-key
calls all succeed unthrottled.

**4. Input sanitization audit:** every free-text zod field previously used
bare `z.string().optional()` — no length or format bound, persisted
straight to the DB. Added `.trim()` everywhere, `.max(255)` on short
identity fields, `.max(5000)` on long-form `@db.Text`-backed fields,
`.max(30)` on phone, `.url().max(2048)` on `recordingUrl`, `.cuid()` format
validation on lead-id fields. **No HTML-sanitization library added** —
confirmed zero `dangerouslySetInnerHTML` usage anywhere in `frontend/src`,
so there was no current stored-XSS vector to close; this is a
data-quality/DoS-surface hardening pass, not a vulnerability fix. Verified:
over-length/malformed/non-cuid payloads all 400 with clear messages; valid
payloads unaffected.

**5. httpOnly-cookie auth migration:**
- Backend: `cookie-parser` added; `server.ts`'s CORS changed from
  `cors()` (allow-all) to an explicit `origin` + `credentials: true`.
  `POST /api/auth/login` now also sets an httpOnly cookie (`SameSite=Lax`,
  12h `maxAge` matching the JWT's own expiry) — **and still returns `token`
  in the JSON body too**, so header-based clients keep working
  indefinitely, not just during a transition (explicit decision: no
  downside to keeping both paths). New `POST /api/auth/logout` clears the
  cookie; new `GET /api/auth/me` lets the frontend rehydrate identity
  without touching the token value. `middleware/auth.ts`'s `requireAuth`
  reads the cookie first, falls back to the `Authorization` header — the
  service-key path is completely unrelated and unchanged. Socket.IO's
  handshake now reads the token from the raw `Cookie` header (Socket.IO's
  handshake is a real HTTP request even though `socket.handshake.auth` is
  JS-supplied) via a small inline parser rather than the `cookie` npm
  package, which needs a `moduleResolution` bump incompatible with this
  project's CommonJS setup.
- Frontend: `lib/api.ts` adds `credentials: 'include'`, removes all
  token-tracking; `AuthContext.tsx` drops `sessionStorage` token
  persistence entirely, rehydrating via `GET /api/auth/me` on mount (added
  an `isLoading` state `RequireAuth` checks to avoid a flash-redirect while
  that request is in flight); `logout()` now calls the real logout endpoint
  before clearing local state; `lib/socket.ts`/`useRealtimeSync` use
  `withCredentials: true` instead of passing a token.
- Verified: `Set-Cookie` present with `HttpOnly`/`SameSite=Lax` on login;
  `/me` and `/logout` work correctly; service-key routes and the
  Authorization-header fallback both unaffected; CORS preflight confirmed
  scoped to the frontend's exact origin with credentials.

**6. Test coverage + CI:** zero tests existed anywhere in the project
before this. Added:
- `backend/api`: `vitest` + a minimal ESLint config (neither existed) — 24
  tests across `escalationService` (assignment/queued branching, room
  emission, transaction timeout options), `leadService` (the
  SALES_EMPLOYEE ownership check from Phase 2f's own auth work), `auth`
  middleware (cookie/header/service-key/invalid/role-mismatch paths), and
  `validation/schemas` (this phase's new bounds). **Mocked-Prisma logic
  tests only** — no live-concurrency test against a real DB this pass (the
  round-robin's actual `FOR UPDATE SKIP LOCKED` behavior was already
  manually verified against the live Neon DB in item 2 above); a dedicated
  test database is a fast-follow if deeper DB-level testing is wanted later.
- `backend/src/server` (Python): `pytest` + `pytest-asyncio` — 12 tests
  covering every LLM-invoked tool handler in `tools/leads.py` by mocking
  `tools.api_client.request`, the single seam every handler funnels
  through.
- `frontend`: `vitest` + React Testing Library + `jsdom` — 5 tests,
  deliberately minimal (not broad component coverage) given zero prior
  baseline: `AuthContext` identity rehydration via a mocked `/me`, and
  `RequireAuth`'s redirect/role-gating behavior.
- `.github/workflows/ci.yml`: three jobs (backend, frontend, python),
  typecheck+lint+test(+build for frontend). No Postgres service
  container — every backend test is a mocked-Prisma logic test, verified
  to pass with `.env` entirely absent.

**Known limitation carried forward:** none — all six Phase 2f items are
now resolved. Remaining future work (not urgent, not blocking): a real test
database for true-concurrency regression testing of the round-robin logic;
broader frontend component test coverage beyond the two smoke-test files;
consider enforcing cookie-only auth (dropping the header fallback) if a
concrete reason to do so ever arises.

### 2026-08-02 — Phase 2g: security + data-model gaps

**Context:** A gap audit was run against the original mega-spec (comparing
every section — Agent Responsibilities, Sales Objectives, Lead Scoring,
Priority, Database Design, Function Calling, Frontend Requirements,
Security, etc. — against this file's own change log) and found 17 items
the original spec asked for that no phase built or explicitly deferred with
a reason. The user prioritized 4 of them for this phase — small, high-value
security/data-model fixes — and explicitly deferred two large items
(outbound calling, a multi-factor scoring engine) to a future phase. See
Roadmap below for the full list of what's still open.

**1. Prompt-injection defense (Security requirement, previously
unaddressed):** traced the full tool-call lifecycle in `bot.py`/
`tools/leads.py` first — confirmed there's no second-order/stored-data
injection vector (no tool ever reads a previous note/summary back into the
LLM context mid-call; the system prompt is set exactly once, at
`on_client_ready`), so the only vector is the caller's live speech. Added a
new "Instruction integrity" section to `build_system_prompt()`
(`prompts.py`), placed next to the existing "Strict scope" section, naming
concrete attack phrasings ("ignore previous instructions," "developer
mode," "repeat the text above") and instructing the model not to
acknowledge detection — framed as "just another off-topic detour" to stay
consistent with the persona's existing redirect pattern. **Stated
limitation:** LLM instruction adherence can't be deterministically
unit-tested — this is a prompt-quality judgment call verified by live/
scripted adversarial testing, not a CI gate.

**2. Lead.priority (P1-P4) — closed an orphaned-field gap:** the
`LeadPriority` enum and `Lead.priority` column existed since Phase 2a and
`backend/api`'s `updateLeadSchema` already accepted it, but no code path
ever set it — the voice agent's `update_lead` tool never exposed `priority`
as a settable field. Added it to `update_lead_function`'s `FunctionSchema`
(`tools/leads.py`) with guidance distinguishing it from `leadScore`
(urgency/timeline vs. quality/sentiment — a HOT lead exploring for next
year is P3-P4, not P1), and folded it into `prompts.py`'s lead-qualification
instructions. **No `backend/api` changes were needed** — confirmed
`leadService.updateLead`'s SALES_EMPLOYEE field-stripping logic only strips
`assignedEmployeeId`, `priority` passes through untouched. Verified:
`PATCH /api/leads/:id` with `{"priority":"P1"}` persists and reflects on a
follow-up `GET`.

**3. Call.handledByEmployeeId — new field, narrowly scoped:** `CallType`
already had a `HUMAN` value but nothing recorded which employee actually
conducted a human-handled call. Added `handledByEmployeeId` (nullable FK to
`Employee`, mirroring the existing `assignedEmployeeId` pattern) via an
additive migration (`20260802181303_add_call_handled_by_employee`), plus
the corresponding `createCallSchema` field. **Explicitly not included this
phase:** no new endpoint or UI flow for a human to manually log a call, no
auto-population from escalation-resolution — those are separate, larger
features. The column exists and can be populated going forward; nothing
populates it automatically yet. Verified: `POST /api/calls` with
`handledByEmployeeId` set succeeds and echoes it back; omitting it (existing
AI-call payloads) still works unchanged.

**4. `languagePreference` documentation fix (doc-only, no code):** the
Foundation-phase entry above incorrectly claimed `languagePreference` was
excluded as speculative alongside `tags`/`metadata`/`location` — in fact
`Lead.language` has existed and been wired through `update_lead`'s tool
schema since the Foundation phase. Corrected in place (see the amended
passage above) rather than silently rewritten, so the historical record
stays honest about the mistake.

**Verified this session:** all new fields tested via direct HTTP calls
(curl) against the live Neon-backed API — `priority` PATCH/GET round-trip,
`handledByEmployeeId` POST with and without the field set (backward
compatibility). Extended `schemas.test.ts` (priority accept/reject,
handledByEmployeeId accept/reject/omitted) and `leadService.test.ts` (a
SALES_EMPLOYEE actor can set `priority` on their own lead while
`assignedEmployeeId` is still stripped) — all 30 backend/api tests pass.
Python `pytest`/`ruff` unchanged and passing. Frontend `models.ts` updated
to include `Call.handledByEmployeeId`; build/typecheck clean.

**Roadmap — explicitly deferred, tracked so nothing is silently dropped:**

*Large items, deferred by explicit user choice to a future phase:*
- Outbound/cold-calling (AI-initiated calls) — needs a telephony/dialer
  integration decision (Twilio vs. Daily vs. other) not yet made anywhere
  in this project; the system is inbound-only today.
- A real multi-factor lead-scoring engine — replacing the single
  LLM-subjective `leadScore` enum (set via `update_lead`) with a
  weighted-rules engine combining budget/urgency/interest/buying-signals/
  conversation-quality/course-fit/availability/decision-timeline.

*Remaining audit gaps, not in this phase's scope (one-line tracking only):*
1. Round-robin priority-queue integration — wiring `Lead.priority` (now
   settable) into `escalationService.ts`'s round-robin ordering itself (the
   original spec frames this as a "future" enhancement, not current scope).
2. Full analytics/reporting dashboards beyond Phases 2b-2e (AI Activities
   log, System Health, Assignment Logs, Daily/Weekly/Monthly Reports, AI
   Success Rate, Conversion Funnel visualization, Revenue Forecast —
   the last two explicitly noted as not buildable from current schema).
3. Real-time features beyond existing lead/call socket events (e.g. live
   call transcription streaming, employee/AI presence indicators).
4. Full RBAC granularity beyond ADMIN/MANAGER/SALES_EMPLOYEE (e.g. a
   distinct MANAGER permission tier, or "AI Agent" as a formal RBAC role
   rather than the service-key mechanism).
5. Conversation transcript persistent storage (deferred at Foundation
   phase pending a Pipecat transcript-processor API; still not built).
6. `tags`/`metadata` JSON blob columns on `Lead` (still deferred, no
   concrete consumer).
7. Separate `location` column on `Lead` (still deferred, no consumer).
8. A UI flow for humans to manually log a HUMAN-type call (this phase adds
   only the `handledByEmployeeId` column, not the flow).
9. Escalation-to-call auto-linking (auto-populating
   `handledByEmployeeId` when an escalation resolves).
10. Dedicated employee/frontend dashboard views named in the original spec
    but not built: Today's Calls, Pending Follow-ups, Completed Calls,
    Upcoming Callbacks, general lead search (beyond the score filter/sort
    from Phase 2c).
11. SMS/email notification channels (only in-app/socket-based cache
    invalidation exists today, not a visible toast/alert/email system).
12. Call recording storage/playback UI (`recordingUrl` column exists, no
    upload/playback flow).
13. A dedicated audit-log/compliance trail beyond Phase 2f's hardening
    (e.g. a who-changed-what `AuditLog` table).

### 2026-08-03 — Phase 2h: outbound calling, multi-factor scoring, 13-gap closure

**Context:** User asked to build both large items Phase 2g deferred
(outbound/cold-calling via Twilio, a multi-factor lead-scoring engine) plus
all 13 smaller tracked gaps, sequenced and verified milestone-by-milestone
like every prior phase. Three read-only research passes (Pipecat's actual
installed Twilio support, the schema's real data-typing for scoring inputs,
and the current frontend/backend structure for the 13 gaps) established
ground truth before planning — see the plan/research notes for full detail;
key findings are folded into the entries below.

**Outbound calling (Twilio):** `bot.py`'s `match runner_args` gained a
`case WebSocketRunnerArguments()` branch using
`pipecat.runner.utils.create_transport(runner_args, TRANSPORT_PARAMS)` —
confirmed via research that installed `pipecat-ai==1.3.0` already ships a
`TwilioFrameSerializer` and telephony auto-detection; Twilio, Telnyx,
Plivo, and Exotel all arrive as the same `WebSocketRunnerArguments` type,
so no dedicated Twilio transport class was needed. Pipecat itself has zero
outbound-call-origination logic (confirmed by exhaustive grep) — origination
is pure application code: new `tools/outbound.py` wraps the `twilio` Python
SDK's `client.calls.create(to=, from_=, url=<TwiML webhook>)`, exposed via
a standalone CLI (`trigger_outbound_call.py`), not an LLM-callable tool
(the LLM never decides mid-conversation to place an outbound call). Once
Twilio's Media Streams WebSocket connects, the resulting call is
indistinguishable from an inbound one to the rest of the pipeline — no
other bot.py/pipeline changes needed. New env vars
(`TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_PHONE_NUMBER`/
`TWILIO_TWIML_WEBHOOK_URL`) are placeholder values (matching how
`EDTECH_KNOWLEDGE_BASE` already handles unfilled business specifics) —
real credentials and live-call verification are the user's to supply and
test; code-level verification here covered dependency install, import
resolution, and exercising the new `match` branch with a synthetic Twilio
`start` event.

**Multi-factor lead scoring engine:** research confirmed the original
spec's 8 named factors (budget/urgency/interest/buying-signals/
conversation-quality/course-fit/availability/decision-timeline) are almost
entirely free text in this schema (`Lead.budget`/`intent`/`urgency`/
`sentiment`, `Call.buyingSignals`/`objections`/etc. are all `String?`/
`@db.Text`) — a literal "weighted rules engine over raw data" wasn't
mechanically buildable. Per user decision: added 6 new nullable `Int`
columns on `Lead` (`budgetScore`/`urgencyScore`/`interestScore`/
`buyingSignalsScore`/`courseFitScore`/`callQualityScore`, each 1-10,
LLM-set via an expanded `update_lead_function` schema — existing free-text
fields are unchanged, sub-scores are a structured addition) plus
`compositeScore Float?`, written only by the backend
(`scoringService.computeCompositeScore`, a pure weighted-average function
over whichever sub-scores are set — returns `null` if none are set rather
than a misleading 0) whenever `leadService.updateLead`'s payload touches
any sub-score field. Weights live in a named, documented-as-tunable
constant (`SCORE_WEIGHTS`), not inline magic numbers.
`LeadsListPage`/`LeadDetailPage` surface sort-by-composite-score and a
score breakdown respectively.

**13 gaps — all resolved or explicitly re-deferred with a stated reason:**

1. **Round-robin priority-queue integration** — `escalationService.listEscalations`
   now sorts `status=queued` results by lead priority (P1/P2 first) then
   `createdAt`. This only affects `AdminEscalationsPage`'s display/
   manual-pickup ordering — round-robin employee-selection fairness is
   unchanged, and this does not preempt an already-assigned lower-priority
   escalation, matching the original spec's own framing of true
   preemption as a future enhancement.
8. **Manual human-call logging UI** — `POST /api/calls` now accepts
   `requireAuth()` (JWT or service key) instead of service-key-only, so
   `LeadDetailPage`'s new "log a call you handled" form can submit a
   `callType: "HUMAN"` call as the assigned employee or an admin/manager.
9. **Escalation-to-call auto-linking** — `callService.createCall` looks up
   the lead's most recent non-resolved escalation and auto-populates
   `handledByEmployeeId` when a `HUMAN` call omits it.
10. **Dedicated dashboard views** — new `GET /api/calls` (didn't exist
    before; calls were only readable nested under a lead) with
    `createdAt`/`leadId`/`handledByEmployeeId` filters, backing a new
    `/calls` page (Today / All time). `GET /api/leads` gained a
    `nextFollowUp` range filter and a free-text name/phone/email search
    param; `LeadsListPage` gained an "upcoming follow-up" toggle rather
    than a separate page, avoiding duplication. "Completed Calls" is
    scoped honestly as "all Call rows in range" — no lifecycle-state
    concept exists on `Call`, documented as a known simplification rather
    than inventing new schema this phase.
12. **Call recording playback UI** — an `<audio controls>` element renders
    wherever `Call.recordingUrl` is already populated. Actual recording
    *capture* stays explicitly deferred — it needs a Pipecat
    audio-frame-to-storage decision not made anywhere in this project.
11. **Email notifications** — per user decision, email-only via SMTP
    (`nodemailer`), no SMS. New `notificationService.ts` (lazily-created,
    reused transporter, matching `tools/api_client.py`'s existing pattern)
    wired into exactly two mutation points: `escalationService.createEscalation`
    (assigned employee, or an admin fallback address when queued) and
    `leadService.updateLead` when `assignedEmployeeId` actually changes
    value. Failures are logged, never thrown.
3. **Presence indicators (partial)** — reuses the existing
   `employee:{id}`/`role:admin` room architecture: an in-memory `Set` of
   connected employee ids, `presence:online`/`presence:offline` events on
   connect/disconnect, `GET /api/employees/online` for initial state,
   an online/offline dot on `AdminEmployeesPage`. Documented as a
   single-instance-deployment limitation (no Redis-backed shared store) —
   not built out speculatively since nothing here runs multi-instance
   today. **Live call transcription streaming (the other half of this gap)
   stays blocked** — no `TranscriptProcessor` in the installed Pipecat
   version, confirmed by Phase 2e's own research.
13. **Audit log** — new `AuditLog` model (`entityType`/`entityId`/`action`/
    `actorId`/`changes` JSON/`createdAt`), `auditService.logAudit()`
    (fire-and-forget, never throws) called from the same four mutation
    points that already emit socket events (`leadService.updateLead`,
    `escalationService.createEscalation`, `callService.createCall`, the
    employee status-toggle route). New admin-only `GET /api/audit-log` +
    read-only `AdminAuditLogPage`.
4. **RBAC granularity — reviewed, no code change** (per user decision).
   Confirmed via exhaustive grep that `MANAGER` is never checked apart from
   `ADMIN` anywhere in `backend/api/src` — every occurrence pairs them in
   an identical allow-list or room-join condition, a deliberate Phase 2d
   design choice, not an oversight. A formal `AI_AGENT` role was considered
   and declined — the service-key mechanism already cleanly models that
   identity outside the JWT/`Role` system.

**Explicitly still deferred, not attempted this phase (unchanged from
Phase 2g's framing, re-confirmed rather than silently dropped):**
- Gap 2 — full analytics/reporting dashboards (AI Activities log, System
  Health, Assignment Logs, Daily/Weekly/Monthly Reports, AI Success Rate,
  Conversion Funnel visualization). Revenue Forecast and any metric needing
  deal-value/call-attempt-outcome data remain **not buildable** from the
  current schema. The buildable remainder is large enough to warrant its
  own focused phase (2i) rather than a rushed partial addition on top of
  this phase's already-large scope.
- Gap 5 — conversation transcript persistent storage. Still blocked: no
  Pipecat transcript-processor API in the installed version.
- Gaps 6/7 — `tags`/`metadata` JSON blobs and a separate `location` column
  on `Lead`. Still no concrete UI consumer proposed anywhere in this
  phase's scope; remain deferred per the Foundation phase's standing
  anti-overengineering decision.

**Schema (one additive migration,
`20260803165917_add_lead_scoring_and_audit_log`):** the 6 sub-score `Int`
columns + `compositeScore Float?` on `Lead`, and the new `AuditLog` model —
batched into one migration rather than one per feature.

**Verified this session:** Python side — `uv sync` installs the new
`twilio` SDK cleanly; `bot.py` and the new `tools/outbound.py`/
`trigger_outbound_call.py` import without error; `ruff`/`pyright` clean;
all 13 Python tests pass (extended with a sub-score-forwarding test for
`update_lead`). Backend/api — `tsc --noEmit` and `eslint` clean throughout
(only pre-existing, unrelated warnings); 53 vitest tests pass (up from 30
at the end of Phase 2g), covering the scoring formula, composite-score
recomputation, queued-escalation priority ordering, the escalation-to-call
auto-link, notification triggers (including SMTP-not-configured no-op and
transporter-failure paths), and audit-log writes. Frontend — `tsc -b &&
vite build` clean at every milestone. **Not verified live this session**
(needs real external credentials/data the user supplies): an actual
Twilio call end-to-end, real SMTP email delivery, and recording playback
against a real `recordingUrl`.
