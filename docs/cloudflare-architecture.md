# Cloudflare in the notifiq architecture

> Analysis document — what adopting Cloudflare (beyond the existing tunnel)
> could mean for notifiq, from edge accessories to a full rewrite. Sources:
> this repo + Cloudflare developer docs (linked inline). Written 2026-10-06.

## TL;DR

- notifiq's Temporal footprint is *small* (~1.5k lines of workflows +
  activities) and maps almost 1:1 onto Cloudflare primitives: a per-event
  workflow → a Durable Object or CF Workflow; Temporal Schedules → DO alarms.
- FastAPI is officially supported on Python Workers (`asgi.entrypoint(app)`),
  so "lift the API, swap the substrate" is a real option — not just a full TS
  rewrite.
- The sharpest fork isn't technical, it's contractual: a CF-native build makes
  "self-host" mean *deploy to your own (free) CF account* rather than
  `docker compose up`. Homelab self-hosters largely accept that trade
  (cloudflared is already the norm); data-residency self-hosters won't.
- Regardless of any CF decision, three seams are worth extracting in the
  current codebase: **Scheduler**, **Delivery**, **Event lifecycle**. The
  Temporal client is currently called from inside activities and API routes;
  a seam makes any migration cheap and makes the existing code more testable.

## As-built architecture (evidence)

**Runtime shape.** One image, three roles (`docker-compose.release.yml`):
`api` (uvicorn + SPA mounts), `worker` (Temporal), `init-db` (alembic).
External deps: `temporal-network`, `phantomlink`, sqlite volume at `/data`.
Edge is `cloudflared` (`docker-compose.yml`, project `notifiq-edge`); tunnel
ingress + DNS owned by `homelab-mono` tofu.

**API.** FastAPI, route modules under `backend/src/api/routes/`: auth (cookie
sessions + refresh tokens + API tokens), events, channels, subscriptions_v1,
organizations/invites, roles (role defs, requirements, assignments —
volunteer/incident scheduling), billing (dormant), admin, usage, otel, health.

**Durable execution.** Two workflows
(`backend/src/workflows/{event,reminder}.py`):

- `EventWorkflow` — one long-lived instance per event. Signals:
  `cancel_event`, `event_updated` (debounced re-notify + reschedule),
  `participant_added`, `notify_subscriber`, `participant_removed_signal`,
  `role_assignment_notification`. Waits on `end_date`, then creates the next
  recurrence and sends a completion notification.
- `ReminderWorkflow` — one-shot, sends to a single subscription.
- Scheduling mechanism: `create_reminder_schedules` creates a **Temporal
  Schedule** per (event, subscription, offset) with a calendar spec matching
  exactly once (`activities/schedules.py`). API routes hold a Temporal client
  and signal workflows directly (`routes/events.py`, `subscriptions_v1.py`,
  `roles.py`, `admin.py`).

**Delivery.** Channels are 13 typed configs (`integration_schemas/` — Gotify,
Email/SMTP, SMS, Twilio, Telegram, Matrix, MS Teams, Bluesky, Pushover,
Signal, Ntfy, Discord, Slack) validated by Pydantic then converted to
**apprise URLs** (`api/services/integration_converters.py`), Fernet-encrypted
on `Channel` rows (`db/models.py`). `NotificationBuilder` builds an Apprise
object per user/subscription/event-subscribers; sends run through
`apprise_notify`/`apprise_anotify` OTEL wrappers; `mailtos://` is the fallback.
Note: `channels/{test,notify,message}` routes already call
`send_notification` **in-process, bypassing Temporal** — the delivery path is
proven to work without the worker.

**State.** sqlite via SQLAlchemy async (postgres DSN path exists).
Domain objects: User, Organization(+Membership/Invitation), Event (recurrence,
series), Channel, Subscription(+Selector per-channel/tag targeting, +Reminder
offsets), Role* , tokens/sessions, invite tokens.

**Frontends.** 12 `frontend-*` apps, all Vite+React SPAs, served as path
mounts (`/mindful`, `/tasks`, `/duty-pager`, ...) from the api service via
`SPA_MOUNTS`. No SSE/WebSocket layer — frontends poll.

**Observability.** OTEL → SigNoz (`src/telemetry.py`).

## Cloudflare primitives — current facts (Oct 2026, from docs)

| Primitive | Relevance | Key numbers |
|---|---|---|
| Workers (standard) | API runtime | Free: 100k req/day, **10ms CPU**, 50 subrequests. Paid ($5/mo): 10M req + 30M CPU-ms incl., 30s–5min CPU (15min cron/queue), 10k–10M subrequests |
| Python Workers | Keep FastAPI | Official: `from workers import asgi; Default = asgi.entrypoint(app)`. Pywrangler bundles deps; pure-python + Pyodide pkgs only. **Durable Objects and Workflows are both definable in Python** (`class X(DurableObject)` w/ `ctx.storage.sql`; `WorkflowEntrypoint` + `step.do/sleep`). ~1s cold start w/ snapshots |
| Durable Objects | Per-event state + timers | SQLite storage **10GB/object**, SQL+KV+PITR(30d), **alarms** (ms precision, single-shot re-armable), hibernating WebSockets. SQLite storage billing since Jan 2026 |
| Workflows | Durable execution | `step.do/sleep/sleepUntil/waitForEvent`. Free: 100 concurrent, 3k steps/day. Paid: **50k concurrent**, 300/s create, 2M queued, 10k–25k steps/instance, 30d retention. Steps billed 500k/mo incl then $0.80/100k |
| Queues | Delivery fan-out | Now on free tier (10k ops/day, 24h retention). Paid: 14d retention, pull consumers over HTTP. `delivery_delay` bounded (hours) — not a day-range scheduler |
| Cron Triggers | Periodic jobs | **5 per account free / 250 paid** — hard cap, vs unlimited Temporal Schedules |
| D1 | Shared relational DB | SQLite semantics; free 5GB + 5M reads/day + 100k writes/day (enforced since Sep 2026); paid 25B reads/50M writes per mo incl. HTTP API for external access |
| Hyperdrive | Keep Postgres on ghost | Pools/caches connections to external PG; pairs with Smart Placement |
| Static Assets | The 12 SPAs | Free+unlimited asset requests; `not_found_handling: single-page-application`; `run_worker_first` for `/api/*`. 20k files free / 100k paid per version |
| Email Service | Outbound email | New: `send_email` binding, REST API, **or SMTP relay**. Domain must be on CF DNS |
| Email Routing | Inbound | Rules → Worker handlers (`forward()` etc.) |
| Containers | Lift the image | **GA Apr 2026**, paid only: full Linux VM behind a Worker, thousands concurrent, Docker Hub images, active-CPU pricing, `sleepAfter` scale-to-idle |
| Access | Auth in front | Protect public hostnames, tunnel backends, **or Workers by name**; JWT consumption or SaaS SSO proxy |
| Tunnel | Already used | `cloudflared` outbound QUIC; status quo |
| Miniflare/workerd | Local/self-host | Same runtime as prod; simulates D1/DO/Queues/Workflows locally — a *dev/test* substrate, not a production self-host target |

## Mapping the current design onto CF

| Today (Temporal) | CF equivalent | Notes |
|---|---|---|
| `EventWorkflow` (signals, wait-until-end) | **Durable Object per event**: RPC methods = signals, `setAlarm(end_date)` = the wait, private SQLite = state. Or a CF Workflow: `waitForEvent` + `sleepUntil` | DO is the better fit: one alarm per object, no concurrency slot held while waiting |
| `ReminderWorkflow` + Temporal Schedules | Rows in the event DO's reminder table + its alarm; or one `Workflow.sleepUntil` instance per reminder | Per-reminder Workflow instances burn the 50k concurrency cap while sleeping; DO alarms don't |
| Activities with RetryPolicy | `step.do(name, {retries:...})` or queue consumer retries | Direct port |
| Task queue / worker | Queue consumer Worker or DO methods | — |
| Activity fan-out to N subscribers | Queue + batched consumer (guaranteed delivery, DLQ) | Also fixes "send to all subscribers" being sequential inside one activity |
| sqlite volume | D1 (shared relational) or per-tenant DO SQLite | D1 for the straightforward port; DO-per-org/user for isolation but cross-entity queries ("my feed") get harder |
| apprise URLs (13 channel types) | `fetch()` per type — 10 of 13 are plain HTTPS APIs (ntfy, gotify, discord, slack, telegram, msteams, pushover, bluesky, twilio, matrix). Email → `send_email` binding/REST API. **Can't port**: arbitrary user SMTP (`mailto:` to their server — no TCP sockets) and Signal (signald socket) | A compact channel dispatcher (~500 lines) covers the 10 HTTP types; SMTP users need the CF Email Service SMTP relay or an API-key provider |
| Cookie sessions + API tokens | Unchanged concepts; Worker validates against D1/DO. Optionally front admin installs with Access | |
| SPAs on path mounts | One Worker, `assets` + `run_worker_first: ["/api/*"]` — identical URL shape | Or per-app static-asset Workers |
| Temporal UI + `set_current_details` | Workflows dashboard, `wrangler tail`, Workers Logs; weaker but real | |
| OTEL → SigNoz | Workers observability/Logpush → SigNoz OTLP collector on ghost | |

## The options, ordered by blast radius

**0 — CF as edge hardening only (days, no code).**
Already have the tunnel. Add Cloudflare Access in front of admin/self-host
hostnames (Access can sit on tunnel public hostnames or on Workers by name).
Zero architecture change; better security story for self-hosters.

**1 — Edge offload (small).**
Move all 12 SPA builds to Workers Static Assets; a thin Worker routes
`/api/*` to the tunnel origin. Free, globally cached statics; origin gets
shielded. The API and Temporal stay exactly as-is. This is also a *partial
migration on-ramp*: the URL shape changes nothing.

**2 — Hybrid delivery plane (moderate, risk: split brain).**
Keep API+DB+Temporal on ghost; move the *timing* layer to CF (a DO alarm or
`Workflow.sleepUntil` per reminder → `fetch` back through the tunnel to an
internal "deliver now" endpoint). Buys durable scheduling without running
Temporal — but Temporal already does this, so it only makes sense as a
transitional slice or if ghost's Temporal is the pain point. Generally
inferior to just fixing the Temporal deploy (or Temporal Cloud — one env var,
`TEMPORAL_URL`, and zero rewrite).

**3 — CF-native port, Python preserved (large).**
FastAPI on Python Workers via the ASGI shim; D1 for the relational store;
DO-per-event for lifecycle + reminder alarms (absorbing both workflows *and*
the schedule machinery into one primitive — **DOs and Workflows are both
definable in Python**, so the Temporal port stays in-language); `send_email`
binding + fetch-based channel drivers; static-asset SPAs. Kept: routes,
schemas, domain logic, language, tests' shape. Replaced: Temporal client/SDK,
SQLAlchemy/aiosqlite (D1 is a binding, not a wire protocol — new data layer,
but still SQLite semantics), apprise (no sockets — driver rewrite to `fetch`),
alembic → `wrangler d1 migrations`. Effort concentrates in data + delivery +
scheduling; the API surface mostly carries over.

**4 — Full TS rewrite (largest, highest ceiling).**
Workers + Hono (or similar) API, DO-per-event/user, Workflows for multi-step
flows, D1, static assets, and — new capability — **hibernating WebSockets**
for live dashboards (mission-control, duty-pager) replacing polling.
Consolidate the 12 SPA dirs into one app shell while at it (the per-app sprawl
is a tax regardless of substrate). Highest upfront cost; smallest long-term
LOC and best platform leverage (DO RPC, colocated storage).

**5 — CF Containers (probably dominated).**
Run the existing `notifiq-app` image in Containers behind a Worker. Still
needs a Temporal server somewhere (Temporal Cloud, or ghost via tunnel), and
an always-on Temporal worker fights the scale-to-idle container model — you'd
pay to keep it warm. Lift-and-shift onto CF infra without the benefits;
option 1 + Temporal Cloud gets most of the value cheaper.

## What "self-hosted" means in each world

- **Options 0–2**: unchanged — `docker compose` on your own box, data at home.
- **Option 3/4**: self-host = `wrangler deploy` + `wrangler d1 create` into
  *your own* CF account on the free tier. Zero infra cost, no port forwarding,
  no VPS — but your notification data lives on CF's network, and you're inside
  free-tier walls (100k req/day, 100k D1 writes/day, 3k workflow steps/day,
  10ms CPU — all fine for a personal notifier, but it's a quota, not a box).
  Honest framing for the docs: *you operate it, Cloudflare hosts it*.
- Keeping both substrates (compose + CF) means maintaining two adapters per
  seam forever. Cheap at notifiq's current Temporal surface area; a real tax
  as it grows.

## "Faithful local run" under CF (the `just stack-up` equivalent)

The constraint that local must mirror prod is well-served — arguably better
than today:

- `wrangler dev` / `vite dev` (or `pywrangler dev`) runs **workerd, the same
  runtime binary as prod**, locally via Miniflare: D1 backed by a real local
  SQLite file, DOs with SQLite storage, Queues, Workflows, cron triggers,
  static assets — all simulated in-process with disk persistence. One command
  replaces the 5-container compose stack **and** the Temporal server.
- Remote bindings can point any binding at real CF resources when needed
  (hybrid local/real dev).
- Test lane upgrades too: `@cloudflare/vitest-pool-workers` runs tests *inside
  workerd* against real simulated bindings; Python side can keep pytest
  against a `pywrangler dev` server.
- Honest gaps: bindings are *simulations* of the distributed services (same
  class of gap as `temporal server start-dev` today — but the runtime itself
  is production-identical). A dockerized workerd self-host image is
  technically possible but non-standard; the supported self-host path is
  `wrangler deploy`.

## Migration-relevant code issues found during this analysis

- **Live bug**: `send_notification_to_subscription` is commented out of the
  worker's activity registry (`worker/main.py:55`) but `ReminderWorkflow`
  calls it (`workflows/reminder.py:84`) — every personal reminder fails at
  fire time. Also means the entire Temporal-Schedule reminder path is
  currently unexercised in prod.
- Temporal coupling is bidirectional: routes signal workflows AND mutate
  schedule handles directly (`subscriptions_v1.py:302`); activities open new
  `Client.connect`s; `services/usage.py` does a `describe()` RPC per event;
  `admin.py` self-heals by re-starting workflows. Any port needs an equivalent
  reconcile surface.
- `Event.content` is `String(500)` abused as a per-app JSON document store —
  a real ceiling for the eisenhower/volunteer apps regardless of substrate.
- `routes/tokens.py` dead code; `UnsubscribeToken` generated but no public
  unsubscribe route exists.
- In-memory rate limiter (600/min/IP) and Radar's request ring don't survive
  multi-instance anything — DO-per-IP would fix this on CF.
- 10 SPAs each vendor their own api client/auth (divergent localStorage
  keys — no SSO across mounts); `frontend-mind` dev-proxies to prod.

## Decision drivers / open questions

1. **Is "self-hosted" = "on my hardware" or "my own instance I control"?**
   CF-native is excellent for the latter and a non-starter for the former.
2. **Canonical service scale?** DO-per-event + alarms scales to millions of
   pending reminders; CF Workflows cap at 50k *concurrent* instances — the DO
   design is the right default either way.
3. **Is the 12-SPA sprawl fixed?** Consolidation roughly halves the rewrite
   cost of option 4 and is worth doing regardless.
4. **Delivery channels**: audit done — 10 of 13 registered types port via
   `fetch()`; arbitrary SMTP + Signal can't. Is dropping those two (or moving
   them behind an email provider API) acceptable?
5. **Reconcile/admin surface**: today's `admin/maintenance/reconcile-workflows`
   heals orphaned workflows — needed on any substrate; on CF it becomes a
   periodic Cron trigger comparing D1 events vs DO index.

## Recommended path

Constraint confirmed: "my own instance" is acceptable self-host **provided
the full stack still runs locally in a prod-faithful way**. `wrangler dev`
(workerd + Miniflare) satisfies that — the same runtime as prod, real local
SQLite, one command. That tips the balance to option 3.

1. **Phase 0 (current codebase, no CF):** extract the three seams —
   `Scheduler`, `Delivery`, `Event lifecycle` (+ auth). Fix the
   `send_notification_to_subscription` registration bug while in there.
   Temporal becomes *an* adapter; the current prod keeps working throughout.
2. **Phase 1 (edge, low risk):** move the 10 SPA builds to Workers Static
   Assets with `run_worker_first: ["/api/*"]` proxying to the tunnel origin.
   Same URLs, immediate global static serving, de-risks the front half of the
   migration. Add Access in front of admin paths if wanted.
3. **Phase 2 (the port):** a `worker/` (wrangler) package in the monorepo:
   - FastAPI → Python Worker (ASGI shim), routes unchanged.
   - SQLAlchemy sqlite → thin D1 data layer behind the existing repositories.
   - `EventWorkflow`+schedules → `EventDO` (alarm + reminder table + signal
     methods); `ReminderWorkflow` → alarm handler (or Python
     `WorkflowEntrypoint` if multi-step logic grows).
   - Channel drivers → `fetch`-based for the 10 HTTP types; email →
     `send_email` binding; SMTP/Signal marked self-host-only or dropped.
   - `wrangler dev` becomes the new `just stack-up`; e2e via
     vitest-pool-workers / pytest against the dev server.
4. **Phase 3 (canonical service):** `wrangler deploy` to the notifiq.net CF
   account (paid plan — $5/mo gets 10M req, 50M D1 rows/mo writes, 500k
   workflow steps). Self-hosters get the same `wrangler deploy` to their free
   account — one codebase, one artifact, two deployment targets.
5. **Option 4 (TS rewrite)** only if consolidating the 12 SPAs and going
   realtime-first (hibernating WS) becomes a product goal — it's a better
   end-state, not a better path.

**What dies:** Temporal server + worker container + `temporal-network`
dependency, SMTP-socket channels, the 3-role compose. **What lives:** the
API, domain model, encrypted-channel scheme, SPA URL shape, python codebase,
and (via Miniflare) the local e2e discipline.

## Sources

- Cloudflare docs: workers/platform/limits + /pricing, durable-objects
  (what-are-durable-objects, sqlite-storage-api, api/alarms, websockets,
  platform/pricing), workflows (index, reference/limits, reference/pricing),
  queues (changelog 2026-02-04 free tier, batching-retries), d1
  (platform/pricing, storage-options comparison), hyperdrive
  (concepts/how-hyperdrive-works), workers/languages/python (+packages/fastapi),
  workers/static-assets (+routing/single-page-application), containers
  (concepts, changelog 2026-04-13 GA), email-service (get-started/send-emails,
  api/send-emails/workers-api, platform/limits), cloudflare-one Access
  (choose-application-type), workers/testing/miniflare.
- Repo: `docker-compose.release.yml`, `docs/self-hosting.md`,
  `backend/src/workflows/{event,reminder}.py`,
  `backend/src/activities/{schedules,notifications,notification_builder}.py`,
  `backend/src/worker/main.py`, `backend/src/db/models.py`,
  `backend/src/api/routes/{events,subscriptions_v1,roles,admin}.py`,
  `backend/src/config/__init__.py`, frontend-*/package.json.
