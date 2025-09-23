# Soonish User Interaction Workflows — Comprehensive Specification

## Overview

This document defines every possible user interaction workflow in the Soonish notification system, detailing the complete end-to-end processes from user intent to system response, including authentication states, data flows, and Temporal workflow orchestration.

---

Note on Terminology: “Subscriber” refers to a person; “Subscription” is the record linking an event to a user. Delivery is resolved via `subscription_selectors` (integration_ids and/or tags). “Participant” may appear as a synonym; we prefer subscriber/subscription.

## User Types & Authentication States

### 1. Anonymous Users
- **Definition**: Users without accounts who interact via public event links
- **Capabilities**: View public events, subscribe with email only
- **Limitations**: No notification preferences, no integration management
- **Data Storage**: non-verified User record with the default email integration record
- **Management**: verification link sent with subscription to event; unverified accounts are trimmed after 60 days without a subscription

### 2. Authenticated Users
- **Definition**: Users with verified accounts and active sessions
- **Capabilities**: Full event management, notification preferences, integration management
- **Data Storage**: Complete User record with associated Integrations

### 3. Event Organizers
- **Definition**: Authenticated users who own events
- **Capabilities**: All authenticated user features plus event management
- **Responsibilities**: Event lifecycle management, subscriber communication

---

## Data Model Specifications (Authoritative)

Conventions:
- All datetimes are UTC.


### users
- id: int PK
- email: varchar, unique, indexed, not null
- name: varchar not null
- is_verified: bool default false
- created_at: datetime default now
- Relationships: `events` (1:N), `integrations` (1:N)
  - Note: for anonymous flows, a fallback display name (e.g., from email local-part) may be used to satisfy NOT NULL.

### events
- id: int PK
- name: varchar not null
- start_date: datetime not null
- end_date: datetime nullable
- temporal_workflow_id: varchar unique not null
- is_public: bool default true
- messaging_policy: enum('off','participants_to_owners','participants_to_owners_moderated','forum_participants_only','forum_readonly') default 'off'
- created_at: datetime default now
- Relationships: `memberships` (1:N EventMembership), `subscriptions` (1:N Subscription)

### subscriptions
- id: int PK
- event_id: int FK -> events.id, not null
- user_id: int FK -> users.id, nullable (anonymous subscribers via session-backed user)
- created_at: datetime default now
- Constraints: UNIQUE(event_id, user_id)

### subscription_selectors
- id: int PK
- subscription_id: int FK -> subscriptions.id, not null
- integration_id: int FK -> integrations.id, nullable
- tag: varchar nullable (stored lowercased)
- created_at: datetime default now
- Constraints:
  - At least one of integration_id or tag is required
  - UNIQUE(subscription_id, integration_id) when integration_id is not null
  - UNIQUE(subscription_id, lower(tag)) when tag is not null

### event_updates
- id: int PK
- event_id: int FK -> events.id, not null
- category: varchar not null  # e.g., general, schedule_change
- title: varchar not null
- body: text not null
- created_at: datetime default now

### event_memberships
- id: int PK
- event_id: int FK -> events.id, not null
- user_id: int FK -> users.id, not null
- role: varchar not null  # 'owner' | 'editor' | 'viewer'
- created_at: datetime default now
- Constraints: UNIQUE(event_id, user_id); at least one 'owner' per event (app-level)

### event_messages
- id: int PK
- event_id: int FK -> events.id, not null
- author_user_id: int FK -> users.id, not null
- title: varchar nullable
- body: text not null
- category: varchar nullable  # e.g., question, comment
- status: varchar not null    # 'pending' | 'approved' | 'rejected'
- reply_to_message_id: int FK -> event_messages.id, nullable
- created_at: datetime default now

### event_messaging_whitelist
- id: int PK
- event_id: int FK -> events.id, not null
- user_id: int FK -> users.id, not null
- created_at: datetime default now
- Constraints: UNIQUE(event_id, user_id)

### integrations
- id: int PK
- user_id: int FK -> users.id, not null
- name: varchar not null
- apprise_url: text not null (encrypted at rest in production)
- tag: varchar not null (stored lowercased; one tag per row)
- is_active: bool default true
- created_at: datetime default now
- Constraints: UNIQUE(user_id, apprise_url, lower(tag))

---

## Assumptions & Constraints

- Assumptions:
  - API datetimes are ISO8601 and UTC (or include explicit timezone offset).
  - Email is required for all subscribers; anonymous subscribers do not have accounts.
  - Apprise supports all needed channels; credentials/tokens are embedded in user-provided Apprise URLs.
- Constraints:
  - Async-first implementation (FastAPI + Temporal).
  - SQLite by default with a clear migration path to Postgres.
  - One EventWorkflow per event; no per-subscriber workflows in the MVP.

## Subscription Workflow Strategy

- Recommended baseline: One `EventWorkflow` per event.
- Rationale:
  - Simple orchestration, minimal workflow count, clear ownership of event lifecycle.
  - Signals (`participant_added`, `participant_removed`, `event_updated`, `send_manual_notification`) cover subscription/event mutations.
- When to introduce `ParticipantWorkflow` (future):
  - Individualized schedules (e.g., user-specific reminder offsets), daily digests, per-subscriber SLAs.
  - Need for durable participant-specific state and retry isolation.
- Alternatives & tradeoffs:
  - Per-subscriber workflows: +granular control, -higher workflow volume and coordination complexity.
  - Per-user workflows: useful for user-level state (sessions/preferences), not required for event notifications today.

## MVP Scope & Acceptance Criteria

- In Scope (MVP):
  - Create events (auth), start per-event Temporal workflows.
  - Subscribe to events (anonymous + authenticated) with integration preferences.
  - Manage user integrations (Apprise URLs) and activation; route notifications by integration.
  - Send manual notifications; schedule 1-day and 1-hour reminders.
  - Environment-driven configuration; audit-friendly logging of deliveries (counts and statuses).
- Out of Scope (MVP):
  - Per-subscriber workflows; recurring events; multi-tenant orgs; mobile apps; advanced scheduling.
- Acceptance Criteria:
  - Event creation starts a Temporal workflow with reminder timers.
  - Adding a participant signals `participant_added` and triggers a welcome notification.
  - Reminders fire at T-1d and T-1h relative to start_date (timezone-aware) (configurable | default).
  - Manual notifications deliver to all subscriptions or to specific `subscription_ids`.
  - Integrations persist Apprise URLs; deliveries occur via Apprise.
  - Configurable via environment variables.

## Idempotency & Concurrency Rules

- Workflow start idempotency via unique `temporal_workflow_id` per event.
- Signals should be safe if delivered more than once; enforce `unique(event_id, email)` for subscriptions to avoid duplicates.
- Activities are at-least-once; notification delivery must tolerate retries (acceptable duplicates or dedup by downstream channel).
- Reminder rescheduling: on start_date change, cancel old timers and schedule new ones atomically to avoid duplicate reminders.
- Database operations in activities should be transactional where applicable.

## UI/UX Flows (HTMX + Alpine.js)

- Public Event Page (anonymous):
  - View event details; subscribe with email (HTMX POST to `/api/events/{id}/subscribe`).
  - Success state swaps in-place confirmation; unsubscribe link provided via email.
- Event Page (authenticated):
  - Show integration multi-select and tag selection; HTMX POST includes `integration_ids` and/or `tags` on subscribe.
- Create Event (authenticated):
  - Form posts to `POST /api/events`; on success, redirect to event page with workflow status widget.
- Integrations (authenticated):
  - List/add/edit integrations; HTMX partials for activation toggle.
- Organizer Dashboard:
  - Subscriptions list, manual notification composer, and workflow health indicators.

## API Surface (Intent)

- **Auth**
  - `POST /api/auth/register`: Begin registration, send verification
  - `POST /api/auth/login`: Authenticate and create session

- **Events**
  - `POST /api/events`: Create new event
  - `GET /api/events/{id}`: Get event (respect visibility)
  - `PATCH /api/events/{id}`: Update event (owner or editor)
  - `POST /api/events/{id}/notify`: Send manual notification (owner or editor; optional subscription_ids)
  - `GET /api/events/{id}/workflow/status`: Introspect workflow health (ops)

- **Event Memberships**
  - `GET /api/events/{id}/members`: List members (owner or editor)
  - `POST /api/events/{id}/members`: Add member (owner only)
  - `PATCH /api/events/{id}/members/{user_id}`: Change role (owner only)
  - `DELETE /api/events/{id}/members/{user_id}`: Remove member (owner only)
- **Subscriptions**
  - `POST /api/events/{id}/subscribe`: Subscribe (anonymous or authenticated)
  - `DELETE /api/events/{id}/subscriptions/{subscription_id}`: Remove subscription (owner or editor)
  - `POST /api/unsubscribe`: One-click unsubscribe (tokenized)

- **Integrations**
  - `GET /api/integrations`: List user integrations (auth)
  - `POST /api/integrations`: Create integration (auth)
  - `PATCH /api/integrations/{id}`: Update activation (auth)
  - `DELETE /api/integrations/{id}`: Remove integration (auth)

- **Health & Ops**
  - `GET /api/health`: Service health
  - `GET /api/temporal/connection`: Temporal connectivity check

## Core User Interaction Workflows

## Workflow 1: User Account Creation & Authentication

Note (MVP): Account verification and session management are implemented outside Temporal for simplicity. Any Temporal workflows described here are future/optional and not part of the MVP.

### 1.1 Account Registration
```
User Intent: Create account to manage events and notifications

Flow:
1. User visits registration page
2. User provides email address
3. System validates email format and uniqueness
4. System creates User record (is_verified=False)
5. System sends verification email via Apprise
6. User clicks verification link
7. System sets is_verified=True
8. System creates default session
9. User redirected to dashboard

Database Changes:
- INSERT User(email, is_verified=False)
- UPDATE User SET is_verified=True (after verification)

Temporal Workflows:
- UserVerificationWorkflow (30-day timeout)
  - Sends verification email
  - Handles verification signals
  - Auto-cleanup unverified accounts
```

### 1.2 User Login
```
User Intent: Access authenticated features

Flow:
1. User provides email/password
2. System validates credentials
3. System creates session token
4. System returns authentication cookie
5. User gains access to authenticated features

Database Changes:
- No direct changes (session management)

Temporal Workflows:
- SessionManagementWorkflow (24-hour timeout)
  - Handles session expiration
  - Cleanup expired sessions
```

## Workflow 2: Event Creation (Authenticated Users Only)

### 2.1 Complete Event Creation Process
```
User Intent: Create new event with notification capabilities

Prerequisites:
- User must be authenticated
- User must have verified email

Flow:
1. User accesses event creation form
2. User provides event details:
   - Event name (required)
   - Start date/time (required)
   - End date/time (optional)
   - Description (optional)
   - Visibility (public/private)
3. System validates input data
4. System generates unique temporal_workflow_id
5. System creates Event record
6. System starts EventWorkflow in Temporal
7. EventWorkflow sends creation notification to organizer
8. System returns event ID and public link
9. User receives confirmation notification

Database Changes:
- INSERT Event(name, start_date, temporal_workflow_id, is_public)
- INSERT EventMembership(event_id, user_id, role='owner')

Temporal Workflows:
- EventWorkflow (30-day lifecycle)
  - Sends creation notification
  - Schedules automatic reminders
  - Handles subscription-related signals
  - Manages event lifecycle

API Endpoints:
- POST /api/events
- GET /api/events/{id}
```

### 2.2 Event Workflow Orchestration
```
EventWorkflow Responsibilities:
1. Send organizer creation notification
2. Ensure Temporal Schedules exist for 1-day and 1-hour reminders (triggering ReminderWorkflow)
3. Listen for signals indefinitely:
    - participant_added
    - participant_removed
    - event_updated
    - send_manual_notification
4. Handle workflow timeout (30 days)

Schedule Architecture:
- Main thread: Signal handling loop
- Reminder schedules: managed via Temporal Schedules
- No long-lived workflow.sleep reminder tasks
- Cleanup schedules on event completion/cancellation
- Ad-hoc reminders (e.g., "remind me in 12 hours") use Temporal SDK workflow.sleep for durability

Flow per Reminder:
1. Temporal Schedule triggers ReminderWorkflow(kind)
2. ReminderWorkflow executes send_notification activity
3. Deliver reminder via resolved selectors (integration_ids and/or tags)
```

## Workflow 3: Event Subscription Workflows

### 3.1 Anonymous User Subscription
Note: Anonymous users are session-backed; do not create a User row until they subscribe to an event or provide an email. When an email is added, a mailto Apprise URL is stored as an Integration for that user. The same user_id is used for subscriptions; later account claim links identity without reconfiguration. Unclaimed session-only users are trimmed after 60 days.
```
User Intent: Subscribe to public event without creating account

Prerequisites:
- Event must be public (is_public=True)
- User has event public link

Flow:
1. User visits public event link
2. System displays event details
3. User provides email address
4. System validates email format
5. System checks for existing subscription
6. If not exists, creates Subscription record
7. System signals EventWorkflow with participant_added
8. EventWorkflow sends welcome notification to email
9. User receives subscription confirmation

Database Changes:
- INSERT Subscription(event_id, user_id, created_at)

Temporal Signals:
- EventWorkflow.participant_added({subscription_id, user_id})

Notification Flow:
- Deliver via resolved selectors (integration_ids and/or tags)
```

### 3.2 Authenticated User Subscription
```
User Intent: Subscribe to event with full notification preferences

Prerequisites:
- User must be authenticated
- Event must be accessible (public or user invited)

Flow:
1. User visits event page (authenticated)
2. System displays event details + notification preferences
3. User selects integrations and/or tags from their available options
4. System creates Subscription(event_id, user_id) and persists SubscriptionSelector rows for chosen integration_ids and/or tags
5. System signals EventWorkflow with participant_added
6. EventWorkflow triggers notification activity
7. Notification activity delivers via resolved selectors

Database Changes:
- INSERT Subscription(event_id, user_id)
- INSERT SubscriptionSelector rows (integration_id and/or tag)

Temporal Signals:
- EventWorkflow.participant_added({subscription_id, user_id})

Notification Flow:
- Deliver via resolved selectors (integration_ids and/or tags)
- If no active targets resolve, mark delivery as `pending`
```

### 3.3 Subscription Notification Routing Logic
```
Notification Routing Algorithm (Selector-based):
1. Load subscriptions (or restrict to `subscription_ids` if provided by the caller).
2. For each subscription:
   a. Load selectors; resolve integration_ids ∪ user integrations matching tags (active only); dedupe
   b. Deliver via each resolved integration's apprise_url; if none resolve, mark pending
3. Execute notification delivery via Apprise and collect per-target results.
```

## Workflow 4: Integration Management (Authenticated Users Only)

### 4.1 Integration Creation
```
User Intent: Add notification channel (Gotify, email, etc.)

Prerequisites:
- User must be authenticated

Flow:
1. User accesses integration management page
2. User selects integration type:
   - Gotify
   - Email (SMTP)
   - Discord
   - Slack
   - Custom Apprise URL
3. User provides integration-specific configuration
4. System validates configuration
5. System creates Integration record
6. System tests notification delivery
7. If test successful, sets is_active=True
8. User receives confirmation via new integration

Database Changes:
- INSERT Integration(user_id, name, apprise_url, is_active=True)

Validation Process:
- Parse Apprise URL format
- Test notification delivery
- Verify integration responds correctly
- Store encrypted URL in production
```

### 4.2 Integration Naming & Activation
```
User Intent: Name and enable/disable integrations

Flow:
1. User views integration list
2. User renames integration and/or toggles activation
3. System updates Integration fields

Database Changes:
- UPDATE Integration SET name = ?, is_active = ? WHERE id = ?
```

## Notification Integration Strategy

- Apprise-first: All notifications are delivered via Apprise using stored `Integration.apprise_url` values.
- Canonical source: The `integrations` table is the single source of truth for user delivery endpoints.
- Channel-agnostic: The Apprise URL encodes both the integration type (email, SMS, etc.) and credentials/tokens.
- No channel-specific app logic: The application does not branch per-channel; Apprise normalizes delivery.
- Production guidance: All production endpoints must be managed via user integrations (Apprise URLs).

## Workflow 5: Event Management & Updates

### 5.1 Event Update Workflow
```
User Intent: Modify event details and notify participants

Prerequisites:
- User must be event organizer
- Event workflow must be active

Flow:
1. User modifies event details
2. System validates changes
3. System updates Event record
4. System signals EventWorkflow with event_updated
5. EventWorkflow notifies ALL subscribers
6. If start_date changed, reschedules reminders
7. Subscribers receive update notification

Database Changes:
- UPDATE Event SET ... WHERE id = ?

Temporal Signals:
- EventWorkflow.event_updated({updated_fields})

Special Rules:
- Event updates notify ALL subscribers
- Start date changes trigger reminder rescheduling
- Organizer cannot modify past events
```

### 5.2 Manual Notification Workflow
```
User Intent: Send custom message to event subscribers

Prerequisites:
- User must be event organizer
- Event workflow must be active

Flow:
1. User accesses notification composer
2. User provides:
   - Notification title
   - Message body
   - Optional: `subscription_ids` to target specific recipients (defaults to all subscriptions)
3. System validates input
4. System signals EventWorkflow with send_manual_notification
5. EventWorkflow triggers notification activity
6. Notification activity targets selected subscriptions (or all)
7. Selected subscriptions receive custom notification

Temporal Signals:
- EventWorkflow.send_manual_notification(title, body, subscription_ids)

Selection Rules:
- If `subscription_ids` provided: only those subscriptions
- If none provided: all subscriptions
```

## Workflow 6: Automated Reminder System

### 6.1 Reminder Scheduling Architecture
```
Reminder Types:
- 1-day before event (reminder_1day)
- 1-hour before event (reminder_1hour)

Implementation:
- Temporal Schedules maintained by EventWorkflow
- Each schedule triggers a ReminderWorkflow instance
- Timezone-aware scheduling
- Automatic cleanup/cancellation after event completion or date change
- Ad-hoc reminders (e.g., "remind me in 12 hours") use Temporal SDK workflow.sleep for durability

Flow per Reminder:
1. Temporal Schedule triggers ReminderWorkflow(kind)
2. ReminderWorkflow executes send_notification activity
3. Deliver reminder via resolved selectors (integration_ids and/or tags)
```

### 6.2 Reminder Notification Routing
```
Routing Logic:
1. Query all Subscriptions for event
2. For each subscription, deliver via resolved selectors (integration_ids and/or tags); if none resolve, mark pending
3. Log delivery results

Content Generation:
- 1-day reminder: "Don't forget! [Event] is tomorrow"
- 1-hour reminder: "[Event] starts in 1 hour"
- Include event details and organizer contact
```

## Workflow 7: Subscription Management

### 7.1 Subscription Removal
```
User Intent: Remove subscription from event

Initiator Options:
- Event organizer removes subscription
- Subscriber self-unsubscribes

Flow (Organizer Removal):
1. Organizer selects subscription to remove
2. System validates organizer permissions
3. System deletes Subscription record
4. System signals EventWorkflow with participant_removed
5. EventWorkflow updates subscription count
6. Optional: Notify remaining subscribers

Flow (Self Unsubscribe):
1. Subscriber clicks unsubscribe link
2. System validates unsubscribe token
3. System deletes Subscription record
4. System signals EventWorkflow with participant_removed
5. System sends unsubscribe confirmation

Database Changes:
- DELETE Subscription WHERE id = ?

Temporal Signals:
- EventWorkflow.participant_removed({participant_data})
```

### 7.2 Subscription Changes
```
User Intent: Modify notification preferences for specific event by adding/removing subscriptions per integration

Prerequisites:
- User must be authenticated

Flow:
1. User accesses event subscription settings
2. User adds or removes selectors for specific integrations or tags
3. System validates that each integration belongs to the user and is active
4. Changes take effect for future notifications

Database Changes:
- INSERT Subscription(event_id, user_id) (if missing)
- INSERT SubscriptionSelector(subscription_id, integration_id?) and/or SubscriptionSelector(subscription_id, tag?)
- DELETE SubscriptionSelector WHERE subscription_id = ? AND (integration_id = ? OR lower(tag) = lower(?))

Validation:
- Ensure each integration ID belongs to the user
- Ignore deactivated integrations; warn user if none remain
```

## Workflow 8: System Administration

### 8.1 Event Lifecycle Management
```
Automated Cleanup:
- EventWorkflow timeout (30 days)
- Past event cleanup (configurable)
- Unverified user cleanup (60 days)
- Session cleanup (expired sessions)

Manual Administration:
- Force event cancellation
- Bulk participant management
- Integration health monitoring
- Notification delivery analytics
```

### 8.2 Monitoring & Analytics
```
Key Metrics:
- Event creation rate
- Participant subscription rate
- Notification delivery success rate
- Integration failure rate
- Workflow completion rate

Data Collection:
- Activity execution logs
- Workflow history
- Integration delivery status
- User engagement metrics
```

## Workflow 9: Participant Messaging & Moderation

### 9.1 Participant Message Submission
```
User Intent: Send a message (e.g., question) to event organizers

Prerequisites:
- Event messaging policy allows messaging (not 'off')
- User is a participant (subscription exists) or authenticated with access

Flow:
1. User submits message via POST /api/events/{id}/messages
2. Server enforces rate limit and validates policy/whitelist
3. System creates EventMessage with status 'approved' or 'pending' (based on policy)
4. If approved: notify organizers (owners/editors) via notification activity
5. If pending: owners/editors can moderate (approve/reject)

Database Changes:
- INSERT EventMessage(event_id, author_user_id, title?, body, category?, status)

Notifications:
- On approval or immediate approval, notify organizers
```

### 9.2 Message Moderation
```
User Intent: Approve or reject participant messages

Prerequisites:
- User is owner or editor

Flow:
1. User reviews pending messages
2. User approves or rejects via PATCH /api/events/{id}/messages/{message_id}
3. On approval, message may appear in forum view (policy-dependent) and notify organizers
```

## Workflow 10: Event Membership Management
```
User Intent: Manage who can edit or own an event

Prerequisites:
- User is owner

Flow:
1. Owner lists members via GET /api/events/{id}/members
2. Owner adds an editor/owner via POST /api/events/{id}/members
3. Owner changes roles or removes members via PATCH/DELETE
4. Prevent removal if it would leave zero owners
```

---

## Environment & Configuration
 
 - Database: `DATABASE_URL` (maps to `Settings.database_url`, default `sqlite+aiosqlite:///./soonish.db`)
 - Temporal: `TEMPORAL_URL` (maps to `Settings.temporal_url`, default `ghost:7233`)
 - Temporal namespace/task queue: `TEMPORAL_NAMESPACE`, `TEMPORAL_TASK_QUEUE`
 - Secret key: `SECRET_KEY` (sessions/tokens)
 - Future email fallback (intent): SMTP settings for anonymous delivery via Apprise `mailto://`
   - `SMTP_SERVER`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM`
   - Used to generate a `mailto://` Apprise URL for anonymous subscribers when no user integrations exist.

---

## Temporal Workflow Orchestration Patterns

### Primary Workflows

Note (MVP): UserVerificationWorkflow and SessionManagementWorkflow are handled outside Temporal; references here are future/optional concepts retained for planning.

1. **EventWorkflow** (per event)
   - Lifecycle: 30 days
   - Responsibilities: Event management, notifications, reminders
   - Signals: participant_added, participant_removed, event_updated, send_manual_notification

2. **UserVerificationWorkflow** (per user registration)
   - Lifecycle: 30 days
   - Responsibilities: Email verification, account activation
   - Signals: verification_completed

3. **SessionManagementWorkflow** (per user session)
   - Lifecycle: 24 hours (configurable)
   - Responsibilities: Session timeout, cleanup

4. **ReminderWorkflow** (per scheduled reminder)
   - Lifecycle: short-lived
   - Triggered by: Temporal Schedules (T-1d, T-1h)
   - Responsibilities: Execute reminder notification for an event

### Workflow Communication Patterns

- **Parent-Child**: UserWorkflow spawns SessionWorkflows
- **Signal-Based**: External systems signal workflows for state changes
- **Activity-Based**: Workflows execute activities for external operations
- **Timer-Based**: Scheduled operations use workflow.sleep()

### Error Handling & Retry Policies

- **Activity Retries**: 3 attempts with exponential backoff
- **Workflow Retries**: Automatic replay on worker restart
- **Dead Letter Queues**: Failed activities after max retries
- **Circuit Breakers**: Integration failure protection

### Activity & Signal Contracts (Intent)

- Workflow `EventWorkflow.run(event_id: int, event_data: dict) -> str`
  - `event_data` minimally includes: `name: str`, `start_date: ISO8601 str`, `is_public: bool`.
 - Signals
  - `participant_added(participant: { subscription_id: int, user_id?: int })`
  - `participant_removed(participant: { email: str })`
  - `event_updated(updated: { start_date?: ISO8601 str, name?: str, ... })`
  - `send_manual_notification(title: str, body: str, subscription_ids?: list[int], notification_level: str = "info")`
  - Activities
  - `send_notification(event_id: int, notification_level: str, title: str, body: str, subscription_ids?: list[int]) -> { delivered: int, failed: int, results: list }`
  - `notification_level` values (MVP): info | warning | critical (permissive validation; unknown values may be accepted and mapped best-effort)

---

## Security & Privacy Considerations

### Data Protection
- Integration URLs encrypted at rest
- Intent (future): email hashing for anonymous flows
- Session tokens cryptographically secure
- API keys stored in environment variables only

### Access Control
- Per-event RBAC via `event_memberships` (roles: owner, editor, viewer)
  - Owners: full control incl. membership management and deletion
  - Editors: update event, manage participants, send notifications
  - Viewers: view-only for private events
- Subscribers control their own integration preferences
- Public events allow anonymous subscription; private events require explicit invitation
- Participant messaging governed by `events.messaging_policy` with optional moderation and whitelist; rate limits enforced

### Audit Trail
- All user actions logged
- Workflow execution history preserved
- Integration delivery status tracked
- Data retention policies enforced

---

## Future Expansion Considerations

### Scalability Patterns
- Horizontal workflow scaling
- Database sharding by tenant
- Integration rate limiting
- Notification batching

### Feature Extensions
- Recurring events
- Event templates
- Advanced scheduling
- Multi-tenant organizations
- Mobile applications
- Webhook integrations

This specification provides the foundation for implementing a complete, production-ready notification system with clear user interaction patterns and robust workflow orchestration.
