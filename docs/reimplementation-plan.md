# Soonish Reimplementation Plan

This plan outlines a step-by-step, incremental rebuild of the Soonish notification system based solely on the specification. Each phase includes goals, concrete deliverables, acceptance criteria, and a diagram.

## Guiding Principles
- Async-first: FastAPI + Temporal.io + async SQLAlchemy.
- Apprise-first delivery via user-managed Apprise URLs stored in `integrations`.
- SQLite locally, clean migration path to Postgres.
- HTMX + Alpine.js for minimal, reactive UI.
- Environment-driven configuration.

## Architecture Overview
```mermaid
flowchart LR
    subgraph ClientUI [Browser UI]
        Client
    end

    Client -->|HTTP| API[FastAPI]
    API <--> DB[(SQLite / Postgres)]
    API <--> TC[Temporal Client]

    subgraph TemporalServer [Temporal Server]
        WQ[Task Queue]
    end

    TC <--> WQ

    subgraph TemporalWorker [Temporal Worker]
        WF[EventWorkflow]
        ACT[Activities: send_notification]
    end

    WQ <--> WF
    WF --> ACT
    ACT --> DB
    ACT --> AP[Apprise]

    subgraph Notify [Notification System]
        AP
        CH[Channels]
    end

    AP --> CH

```

---

## Phase 4a — Event Membership Management (RBAC)
- Goals
  - Allow owners to add/remove members and change roles (owner|editor|viewer).
- Deliverables
  - `GET/POST/PATCH/DELETE /api/events/{id}/members` endpoints.
- Acceptance
  - UNIQUE(event_id, user_id) enforced; cannot remove the last owner.

```mermaid
sequenceDiagram
  participant Owner
  participant API
  participant DB
  Owner->>API: POST /api/events/{id}/members (user_id, role)
  API->>DB: INSERT EventMembership(event_id, user_id, role)
  Owner->>API: PATCH /api/events/{id}/members/{user_id} (role)
  API->>DB: UPDATE EventMembership SET role=...
  Owner->>API: DELETE /api/events/{id}/members/{user_id}
  API->>DB: DELETE EventMembership WHERE ... (validate at least one owner remains)
```

---

 

## Phase 1 — Data Model & Database
- Goals
  - Implement core data models:
    - `users`
    - `events` 
    - `event_memberships` 
    - `subscriptions`
    - `subscription_selectors`
    - `integrations`
- Deliverables
  - SQLAlchemy models + async DB session utilities.
  - DB init script and migration notes.
- Acceptance
  - Tables create successfully; CRUD sanity checks pass.

```mermaid
classDiagram
  class User {
    int id
    string email
    string name
    bool is_verified
    datetime created_at
  }
  class Event {
    int id
    string name
    datetime start_date
    datetime end_date
    string temporal_workflow_id
    bool is_public
    string messaging_policy
    datetime created_at
  }
  class Subscription {
    int id
    int event_id
    int user_id
    datetime created_at
  }
  class SubscriptionSelector {
    int id
    int subscription_id
    int integration_id
    string tag
    datetime created_at
  }
  class Integration {
    int id
    int user_id
    string name
    text apprise_url
    string tag
    bool is_active
    datetime created_at
  }
  class EventMembership {
    int id
    int event_id
    int user_id
    string role
    datetime created_at
  }
  Event "1" --o "*" Subscription: has
  Subscription "1" --o "*" SubscriptionSelector: selectors
  User "1" --o "*" Integration: has
  Event "1" --o "*" EventMembership: members
  User "1" --o "*" EventMembership: roles
```

---

## Phase 2 — Temporal Connectivity & Worker Skeleton
- Goals
  - Connect to Temporal server at `TEMPORAL_URL`.
  - Register `EventWorkflow` and `send_notification` activity.
- Deliverables
  - Worker entrypoint and process docs.
- Acceptance
  - Worker connects, starts, and idles on task queue.

```mermaid
sequenceDiagram
  participant Worker
  participant Temporal
  Worker->>Temporal: Connect (TEMPORAL_URL, namespace)
  Worker->>Temporal: Register workflows/activities
  Temporal-->>Worker: Listening on task queue
```

---

## Phase 3 — Event Creation API + Workflow Start
- Goals
  - `POST /api/events` creates event and starts EventWorkflow.
- Deliverables
  - Endpoint, DB write, Temporal client start, workflow ID strategy.
- Acceptance
  - Response returns event ID + workflow ID; workflow visible in Temporal.

```mermaid
sequenceDiagram
  participant U as User
  participant UI as UI (HTMX)
  participant API
  participant DB
  participant TC as Temporal Client
  participant W as Worker
  participant WF as EventWorkflow
  U->>UI: Submit Create Event form
  UI->>API: POST /api/events
  API->>DB: INSERT Event(..., temporal_workflow_id)
  API->>DB: INSERT EventMembership(event_id, user_id, role='owner')
  API->>TC: start_workflow(EventWorkflow.run, event_id, event_data)
  TC->>W: Queue start on task queue
  W->>WF: Start run(event_id, event_data)
  API-->>UI: 201 Created (event_id, workflow_id)
```

---

## Phase 4 — Integration Management (Apprise URLs)
- Goals
  - User creates/list/updates integrations with tags.
- Deliverables
  - `GET/POST/PATCH/DELETE /api/integrations` (auth required).
- Acceptance
  - Apprise URLs stored; tag assignments persisted.

```mermaid
sequenceDiagram
  participant U as User
  participant API
  participant DB
  U->>API: POST /api/integrations (name, apprise_url, tags)
  API->>DB: INSERT Integration
  API-->>U: 201 Created (integration_id)
```

---

## Phase 5 — Subscriptions (Anonymous session-backed + Authenticated)
- Goals
  - Allow anonymous (session-backed) and authenticated users to subscribe.
  - Configure delivery via selectors: explicit integration_ids and/or tags (tags stored lowercased).
- Deliverables
  - `POST /api/events/{id}/subscribe` upserts subscription and selectors; `PATCH` supports mode add|remove|replace (default add).
- Acceptance
  - Subscription created; selectors stored (integration_ids/tags). Anonymous users persist via a session-backed user_id.
  - Workflow signaled with `participant_added`.

```mermaid
sequenceDiagram
  participant U as User
  participant UI as UI (HTMX)
  participant API
  participant DB
  participant TC as Temporal Client
  participant W as Worker
  U->>UI: Submit Subscribe form (email, integration_ids, tags)
  UI->>API: POST /api/events/{id}/subscribe (integration_ids, tags)
  API->>DB: INSERT Subscription(event_id, user_id); INSERT SubscriptionSelector rows
  API->>TC: signal(event_workflow_id, participant_added, {subscription_id, user_id})
  TC->>W: Deliver signal
```

---

## Phase 6 — Notification Activity (Selector Expansion Routing)
- Goals
  - Implement `send_notification` activity resolving selectors: explicit integration_ids ∪ user integrations matching tags (is_active only, deduped).
  - Fallback: if no active targets remain and user has a mailto Integration, deliver via it; otherwise mark pending.
- Deliverables
  - Activity implementation and structured delivery results.
- Acceptance
  - Manual notifications deliver to selected subscriptions (or all) via resolved channels or email fallback.

```mermaid
sequenceDiagram
  participant WF as EventWorkflow
  participant ACT as send_notification
  participant DB
  participant AP as Apprise
  participant CH as Channels
  WF->>ACT: Execute(title, body, subscription_ids?)
  ACT->>DB: Load event + subscriptions (+selectors + user.integrations)
  ACT->>AP: Notify via Apprise URLs (selected integrations or mailto fallback)
  AP->>CH: Deliver to channels
  ACT-->>WF: {delivered, failed, results[]}
```

---

## Phase 7 — Reminder Scheduling (T-1d, T-1h)

- Goals
  - Utilize Temporal Schedules for event-relative reminders; ad-hoc "remind me in N hours" uses Temporal SDK workflow.sleep for durability.
- Deliverables
  - ReminderWorkflow implementation
- Acceptance
  - Reminders fire at correct times; visible in logs.
  - Time change in event results in appropriate updates of schedules

---

## Phase 8 — Manual Notifications (Organizer)
- Goals
  - Organizer sends manual notifications to all participants according to their preferences
  - Updates assigned a category that users can choose to get notified about or opt-out of
- Deliverables
  - `POST /api/events/{id}/notify` -> signal `send_manual_notification`.
- Acceptance
  - Notifications delivered to participants based on their individual preferences
  
```mermaid
sequenceDiagram
  participant Org as Organizer
  participant API
  participant TC as Temporal Client
  participant W as Worker
  participant WF as EventWorkflow
  Org->>API: POST /api/events/{id}/notify (title, body, audience_tags?, message_tags?, subscription_ids?)
  API->>TC: signal(workflow_id, send_manual_notification,...)
  TC->>W: Deliver signal
  W->>WF: Handle signal -> activity send_notification
```

---

## Phase 9 — UI (HTMX + Alpine.js)
- Goals
  - Minimal pages for create event, view event, subscribe, integrations, organizer dashboard.
- Deliverables
  - Server-rendered HTML with HTMX partials.
- Acceptance
  - Full happy-path flows via browser.

```mermaid
flowchart TD
  Home --> CreateEvent
  CreateEvent --> EventPage
  EventPage --> SubscribeAnon
  EventPage --> SubscribeAuthed
  EventPage --> ManualNotify
  EventPage --> Participants
  Nav --> Integrations
```

---

## Phase 10 — Observability & Ops
- Goals
  - Structured logs, summary of delivery results, health checks.
- Deliverables
  - `/api/health`, Temporal connectivity check, request IDs.
- Acceptance
  - Operators can observe workflow health and delivery outcomes.

```mermaid
sequenceDiagram
  participant API
  participant Worker
  participant Temporal
  API->>API: GET /api/health -> 200 OK
  API->>Temporal: Connectivity probe
  Worker-->>Temporal: Heartbeat via task queue activity execution
```

---

## Phase 11 — Security & Privacy
- Goals
  - Env-driven secrets, audit trail guidance, anonymous email hashing intent.
- Deliverables
  - Configured secrets, log redaction guidelines.
- Acceptance
  - No secrets in code; sensitive logs are filtered.

---

## Phase 12 — Cutover & Packaging
- Goals
  - Document `uv` workflows, `.env` usage, worker/app startup.
- Deliverables
  - README quickstart, Makefile or scripts, deployment notes.
- Acceptance
  - New developer can boot app and worker from spec and plan alone.

---

## Traceability to Spec
- Data models, workflows, activities, routing, and API endpoints map 1:1 to sections in `docs/user-interaction-workflows.md`.
- Open design items tracked in `docs/spec-open-questions.md`.
