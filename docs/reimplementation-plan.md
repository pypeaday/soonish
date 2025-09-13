# Soonish MVP Reimplementation Plan

This plan outlines a step-by-step, incremental rebuild of the Soonish notification system based solely on the specification. Each phase includes goals, concrete deliverables, acceptance criteria, and a diagram.

## Guiding Principles
- Async-first: FastAPI + Temporal.io + async SQLAlchemy.
- Apprise-first delivery via user-managed Apprise URLs stored in `integrations`.
- One EventWorkflow per event (no per-subscriber workflow in MVP).
- SQLite locally, clean migration path to Postgres.
- HTMX + Alpine.js for minimal, reactive UI.
- Environment-driven configuration.

## Architecture Overview
```mermaid
flowchart LR
    subgraph Client[Browser UI (HTMX + Alpine)]
    end
    Client -->|HTTP| API[FastAPI]
    API <--> DB[(SQLite / Postgres)]
    API <--> TC[Temporal Client]
    subgraph Temporal[Temporal Server]
      WQ[Task Queue]
    end
    TC <--> WQ
    subgraph Worker[Temporal Worker]
      WF[EventWorkflow]
      ACT[Activities: send_notification]
    end
    WQ <--> WF
    WF --> ACT
    ACT --> DB
    ACT --> AP[Apprise]
    AP --> CH[Channels (email, sms, discord, slack, ...)]
```

---

## Phase 0 — Repository Bootstrap
- Goals
  - Initialize project with `uv`, `.env`, and base folders.
- Deliverables
  - `pyproject.toml`, `src/` layout, `docs/`, `tests/`, `.env.example`.
- Acceptance
  - `uv run` boots a placeholder FastAPI app returning health OK.

```mermaid
sequenceDiagram
  participant Dev
  participant Repo
  Dev->>Repo: Initialize project with uv
  Dev->>Repo: Add base FastAPI app + health endpoint
  Dev->>Repo: Commit baseline
```

---

## Phase 1 — Data Model & Database
- Goals
  - Implement data models: `users`, `events`, `event_participants`, `integrations`.
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
    bool is_verified
    datetime created_at
  }
  class Event {
    int id
    int owner_user_id
    string name
    datetime start_date
    datetime end_date
    string temporal_workflow_id
    bool is_public
    datetime created_at
  }
  class EventParticipant {
    int id
    int event_id
    int user_id
    string email
    string selected_integration_ids
    datetime created_at
  }
  class Integration {
    int id
    int user_id
    string name
    text apprise_url
    bool is_active
    datetime created_at
  }
  User "1" --o "*" Event: owns
  Event "1" --o "*" EventParticipant: has
  User "1" --o "*" Integration: has
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

## Phase 5 — Subscriptions (Anonymous + Authenticated)
- Goals
  - Allow anonymous (email-only) and authenticated users to subscribe.
  - Authenticated users can select one or more of their integrations for this event.
  - Optional participant tag preferences for content categories.
- Deliverables
  - `POST /api/events/{id}/subscribe` handling both cases.
- Acceptance
  - Participant record created (stores `selected_integration_ids` when provided).
  - Workflow signaled with `participant_added`.

```mermaid
sequenceDiagram
  participant U as User
  participant UI as UI (HTMX)
  participant API
  participant DB
  participant TC as Temporal Client
  participant W as Worker
  U->>UI: Submit Subscribe form (email, selected integrations)
  UI->>API: POST /api/events/{id}/subscribe (selected_integration_ids)
  API->>DB: INSERT EventParticipant(event_id, user_id?, email, selected_integration_ids)
  API->>TC: signal(event_workflow_id, participant_added, {email})
  TC->>W: Deliver signal
```

---

## Phase 6 — Notification Activity (Integration-first Routing)
- Goals
  - Implement `send_notification` activity reading participants and delivering via their selected integrations.
  - Fallback intent: SMTP mailto if no endpoints remain; else mark pending.
- Deliverables
  - Activity implementation and structured delivery results.
- Acceptance
  - Manual notifications deliver to selected participants (or all) via selected integrations or email fallback.

```mermaid
sequenceDiagram
  participant WF as EventWorkflow
  participant ACT as send_notification
  participant DB
  participant AP as Apprise
  participant CH as Channels
  WF->>ACT: Execute(title, body, participant_ids?)
  ACT->>DB: Load event + participants (+user.integrations)
  ACT->>AP: Notify via Apprise URLs (selected integrations or mailto fallback)
  AP->>CH: Deliver to channels
  ACT-->>WF: {delivered, failed, results[]}
```

---

## Phase 7 — Reminder Scheduling (T-1d, T-1h)
- Goals
  - Schedule two timers relative to start_date; deliver reminders via activity.
- Deliverables
  - Concurrent tasks in workflow; timezone-aware.
- Acceptance
  - Reminders fire at correct times; visible in logs.

```mermaid
flowchart LR
  Start[Workflow start]
  Start --> Parse[Parse start_date]
  Parse --> T1[Schedule T-1d]
  Parse --> T2[Schedule T-1h]
  T1 -->|sleep until| R1[send_notification(reminder_1day)]
  T2 -->|sleep until| R2[send_notification(reminder_1hour)]
```

---

## Phase 8 — Manual Notifications (Organizer)
- Goals
  - Organizer sends manual notifications to all or by tags.
- Deliverables
  - `POST /api/events/{id}/notify` -> signal `send_manual_notification`.
- Acceptance
  - Notifications delivered to participants filtered by audience/message tags or explicit participant IDs.

```mermaid
sequenceDiagram
  participant Org as Organizer
  participant API
  participant TC as Temporal Client
  participant W as Worker
  participant WF as EventWorkflow
  Org->>API: POST /api/events/{id}/notify (title, body, audience_tags?, message_tags?, participant_ids?)
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
