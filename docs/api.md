# Notifiq API

Base path: `/api/v1`. Interactive docs: `/docs` on any instance
(Swagger UI). Full contract: `notifiq.openapi.json` at the repo root —
every `frontend-*` and the `notifiq` CLI consume it.

## Auth

Token auth, `Authorization: Bearer <token>`.

```bash
# register (requires `name`; email must be a real domain — no .local/.test)
curl -X POST $BASE/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"me@example.com","password":"…","name":"Me"}'

# login → {"access_token": "…"}
curl -X POST $BASE/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"me@example.com","password":"…"}'
```

New accounts need email verification before event/channel writes. In
`DEV_MODE` deployments (the e2e stack), a passwordless **verified** admin is
provisioned: log in as `admin@example.com` with any password.

## Core resources

| Area | Endpoints |
|---|---|
| Events | `GET/POST /api/v1/events`, `GET /api/v1/events/{id}`, `GET /api/v1/events/public` |
| Subscriptions | `/api/v1/subscriptions` — subscribe a user to event categories |
| Channels | `GET/POST /api/v1/channels`, `DELETE /api/v1/channels/{id}` — typed delivery configs (gotify/email/sms/ntfy/…) |
| Users | `GET/PATCH /api/v1/users/me` |
| Invites | `/api/v1/invites` |
| Health | `GET /api/v1/health` — liveness + Temporal/DB diagnostics |

`POST /api/v1/events` kicks off a Temporal `EventWorkflow`
(`validate_event_exists → send_notification_to_subscribers →
get_subscription_reminders → create_reminder_schedules → timer`) — events
are the unit of "something happened, notify subscribers".

### Channel creation shape

Channels are **typed configs**, not raw Apprise URLs:

```json
POST /api/v1/channels
{"name":"demo-alerts","channel_type":"ntfy","config":{"apprise_url":"ntfy://…"},"tag":"ops"}
```

Per-type config fields live in `backend/src/api/integration_schemas/`.

## The `notifiq` CLI

A thin authenticated client shipped in `backend/` (typer+rich, imports the
API schemas directly):

```bash
cd backend
uv run notifiq login -e me@example.com -p … -u http://localhost:32780
uv run notifiq events list
uv run notifiq events create "Deploy window" --start 1h --source ops
uv run notifiq channels list
```

Config file `~/.config/notifiq/config`, or env `NOTIFIQ_BASE_URL` /
`NOTIFIQ_TOKEN`. `uv run notifiq --help` for the full command tree.
