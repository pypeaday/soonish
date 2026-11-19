# Self-hosting Notifiq

> Status: functional, not yet polished. The compose shape below is what
> production runs; a turnkey self-hoster image is on the roadmap.

## Shape

One image (`git.paynepride.com/nic/notifiq-app:release` in prod) runs three
roles:

```text
api     uvicorn src.api.main:app          — FastAPI + serves all SPA mounts
worker  python -m src.worker.main         — job runner (polls scheduled_jobs)
init-db uv run alembic upgrade head       — one-shot migration job
```

No external scheduler is required: reminders, event-end handling, recurrence
and notification retries are rows in `scheduled_jobs` inside the same
sqlite/postgres database.

Reference files:
- `docker-compose.stack.yml` — **self-contained** (sqlite volume); the e2e
  lane, also the simplest self-host path
- `docker-compose.release.yml` — prod-shaped (sqlite)
- `docker-compose.postgres.yml` — postgres variant (`backend/POSTGRES_MIGRATION.md`)

## Quick start (self-contained)

```bash
scripts/agent-stack.sh up     # generates .env.stack (ephemeral keys), builds, waits healthy
scripts/agent-stack.sh url    # print the URLs
```

Or bare compose (bring your own `.env.stack` — see `generate_env` in
`scripts/agent-stack.sh` for the required keys):

```bash
STACK_IMAGE=notifiq docker compose -f docker-compose.stack.yml up -d --build
```

Or via the harness: `just stack-up` (builds this checkout, ephemeral ports,
`just stack-down` removes everything including the sqlite volume).

## Key env vars

| Var | Purpose |
|---|---|
| `SECRET_KEY`, `ENCRYPTION_KEY` | session + at-rest crypto — generate per install |
| `DATABASE_URL` | `sqlite+aiosqlite:////data/notifiq.db` or postgres DSN |
| `DEV_MODE` | `true` = passwordless dev admin (`admin@example.com`) — **never in prod** |
| `ADMIN_EMAILS` | comma-separated admin list |
| `SPA_MOUNTS` / `FRONTEND_URLS` / `SPA_ROOT` | SPA mount map; defaults serve all 10 apps |
| `CORS_ORIGINS`, `COOKIE_SECURE`, `TRUST_PROXY_HEADERS` | set correctly for your TLS/proxy |
| `OTEL_ENABLED` (+ `OTEL_EXPORTER_OTLP_*`) | traces/metrics to a collector |

Behind a reverse proxy (production uses cloudflared): set
`TRUST_PROXY_HEADERS=true`, `COOKIE_SECURE=true`, and `FRONTEND_BASE_URL`
/`API_BASE_URL` to the public origin.

## Verifying an install

`GET /api/v1/health` reports DB + scheduler (dead-job count) health. The SPA front door
(`/` plus each mount, e.g. `/mission-control/`) should return 200; the stack
lane's `just stack-test` runs exactly that smoke list.
