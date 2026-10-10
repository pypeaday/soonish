# Self-hosting Notifiq

> Status: functional, not yet polished. The compose shape below is what
> production runs; a turnkey self-hoster image is on the roadmap.

## Shape

One image (`git.paynepride.com/nic/notifiq-app:release` in prod) runs three
roles:

```text
api     uvicorn src.api.main:app          — FastAPI + serves all SPA mounts
worker  python -m src.worker.main         — Temporal worker
init-db uv run alembic upgrade head       — one-shot migration job
```

plus a Temporal server (`temporalio/admin-tools` for self-contained setups;
production uses an external Temporal on `temporal-network`).

Reference files:
- `docker-compose.stack.yml` — **self-contained** (embedded Temporal +
  sqlite volume); the e2e lane, also the simplest self-host path
- `docker-compose.release.yml` — prod-shaped (external Temporal, sqlite)
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
| `TEMPORAL_URL` / `TEMPORAL_NAMESPACE` / `TEMPORAL_TASK_QUEUE` | worker + api Temporal client |
| `DEV_MODE` | `true` = passwordless dev admin (`admin@example.com`) — **never in prod** |
| `ADMIN_EMAILS` | comma-separated admin list |
| `SPA_MOUNTS` / `FRONTEND_URLS` / `SPA_ROOT` | SPA mount map; defaults serve all 10 apps |
| `CORS_ORIGINS`, `COOKIE_SECURE`, `TRUST_PROXY_HEADERS` | set correctly for your TLS/proxy |
| `OTEL_ENABLED` (+ `OTEL_EXPORTER_OTLP_*`) | traces/metrics to a collector |

Behind a reverse proxy (production uses cloudflared): set
`TRUST_PROXY_HEADERS=true`, `COOKIE_SECURE=true`, and `FRONTEND_BASE_URL`
/`API_BASE_URL` to the public origin.

## Verifying an install

`GET /api/v1/health` reports DB + Temporal connectivity. The SPA front door
(`/` plus each mount, e.g. `/mission-control/`) should return 200; the stack
lane's `just stack-test` runs exactly that smoke list.
