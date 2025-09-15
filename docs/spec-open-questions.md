# Spec Open Questions (Running TODO)

## Workflow Architecture
- Decision: One EventWorkflow per event; per-subscriber workflows deferred until individualized schedules/digests are needed.
- Keep short-lived workflows for verification/session outside Temporal for now; revisit post reimplementation.

## Notifications
- Delivery semantics: at-least-once; dedupe/idempotency keys are a future enhancement.
- Fallback: if no active targets remain and the user has a mailto Integration, use it; otherwise mark pending. No global SMTP fallback.

## Data Model
- No `subscriptions.email`; anonymous flows use session-backed users; uniqueness is `unique(event_id, user_id)`.
- Column-level encryption for `integrations.apprise_url` (library/approach and key management) remains to be selected.
- Subscription selectors: adopted as `subscription_selectors (subscription_id, integration_id?, tag?)`.
  - Constraints: one of integration_id or tag required; UNIQUE(subscription_id, integration_id) and UNIQUE(subscription_id, lower(tag)).
  - Default when no selectors present: no delivery (pending) until selectors added.

## Event Updates & Reminders
- Event-relative reminders via Temporal Schedules (idempotent naming) and rescheduling on start_date changes.
- Ad-hoc "remind me in N hours" via Temporal SDK workflow.sleep for durability.

## API & Security
- Unsubscribe tokens: opaque random tokens, 60-day TTL, single-use, stored server-side.
- Private events: invitation model, access rules, and invitation token lifecycle.
- Subscribe request: validate `integration_ids` belong to the authenticated user; reject foreign IDs; define behavior if an integration is deactivated or deleted.
- Subscription preference updates: PATCH supports mode add|remove|replace (default add).

## Observability
- Persist a `NotificationLog` entity for delivery analytics, retries, and traceability.
- Standardize structured logging fields (event_id, workflow_id, correlation_id) across activities and workers.

## DevX & Ops
- Migration strategy: Alembic workflow and SQLite→Postgres steps, including adding constraints/indexes not supported in SQLite.
- Integration rate limiting and circuit breaker thresholds (per channel and per user) remain to be tuned.
- Migrations include `subscription_selectors` join table as normalized replacement for per-subscription channel selection.
