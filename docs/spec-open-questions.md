# Spec Open Questions (Running TODO)

## Workflow Architecture
- Do we standardize on one EventWorkflow per event (current) and defer per-subscriber workflows until individualized schedules/digests are needed?
- Should we introduce short-lived workflows for account verification or session management, or keep these outside Temporal for now?

## Notifications
- Delivery semantics: accept at-least-once delivery; do we need deduplication or idempotency keys for manual notifications?
 - Fallback scope: Confirm broadened mailto fallback applies to any participant with zero endpoints (selected or tag-based) when SMTP is configured.

## Data Model
- Enforce `unique(event_id, email)` on `event_participants` to prevent duplicate subscriptions?
- Column-level encryption for `integrations.apprise_url` (library/approach and key management)?
- Participant→Integration selection: replace `event_participants.selected_integration_ids` CSV with a join table `participant_integrations (participant_id, integration_id)`; define FKs and cascade semantics.
 - Default behavior if a participant selects no integrations at subscribe-time: deliver via all active user integrations for this event vs. email fallback?

## Event Updates & Reminders
- Implement `_schedule_reminders()` to cancel and reschedule timers on start_date changes.
- Define timer cancellation semantics to avoid duplicate reminders when updates occur close to scheduled times.

## API & Security
- Unsubscribe tokens: format, expiry, scope, and revocation strategy.
- Private events: invitation model, access rules, and invitation token lifecycle.
- Subscribe request: validate `selected_integration_ids` belong to the authenticated user; reject foreign IDs; define behavior if an integration is deactivated or deleted.
 - Participant preference updates: endpoint to overwrite `selected_integration_ids` with full replacement vs. additive edits.

## Observability
- Persist a `NotificationLog` entity for delivery analytics, retries, and traceability.
- Standardize structured logging fields (event_id, workflow_id, correlation_id) across activities and workers.

## DevX & Ops
- Migration strategy: Alembic workflow and SQLite→Postgres steps, including adding constraints/indexes not supported in SQLite.
- Integration rate limiting and circuit breaker thresholds (per channel and per user).
 - Migrations for introducing the `participant_integrations` join table when normalizing away from CSV.
