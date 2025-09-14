# Spec Open Questions (Running TODO)

## Workflow Architecture
- Do we standardize on one EventWorkflow per event (current) and defer per-subscriber workflows until individualized schedules/digests are needed?
- Should we introduce short-lived workflows for account verification or session management, or keep these outside Temporal for now?

## Notifications
- Delivery semantics: accept at-least-once delivery; do we need deduplication or idempotency keys for manual notifications?
 - Fallback scope: Confirm mailto fallback applies to any subscription with zero resolved channels (no selectors resolved) when SMTP is configured (anonymous only).

## Data Model
- Enforce `unique(event_id, email)` on `subscriptions` to prevent duplicate subscriptions?
- Column-level encryption for `integrations.apprise_url` (library/approach and key management)?
- Subscription selectors: implemented as `subscription_selectors (subscription_id, integration_id?, tag?)`; confirm FKs, uniqueness, and cascade semantics.
 - Default behavior if an authenticated subscription has no selectors at subscribe-time: deliver via all active user integrations vs. no delivery until selectors added?

## Event Updates & Reminders
- Implement `_schedule_reminders()` to cancel and reschedule timers on start_date changes.
- Define timer cancellation semantics to avoid duplicate reminders when updates occur close to scheduled times.

## API & Security
- Unsubscribe tokens: format, expiry, scope, and revocation strategy.
- Private events: invitation model, access rules, and invitation token lifecycle.
- Subscribe request: validate `integration_ids` belong to the authenticated user; reject foreign IDs; define behavior if an integration is deactivated or deleted.
 - Subscription preference updates: endpoints to add/remove selectors (integration_ids, tags); define semantics for full replacement vs. additive edits.

## Observability
- Persist a `NotificationLog` entity for delivery analytics, retries, and traceability.
- Standardize structured logging fields (event_id, workflow_id, correlation_id) across activities and workers.

## DevX & Ops
- Migration strategy: Alembic workflow and SQLite→Postgres steps, including adding constraints/indexes not supported in SQLite.
- Integration rate limiting and circuit breaker thresholds (per channel and per user).
 - Migrations for introducing/evolving the `subscription_selectors` join table as the normalized replacement for per-subscription channel selection.
