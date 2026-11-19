---
name: stack
description: Isolated local e2e stack for a notifiq checkout/worktree — api + worker + all frontends built from source, on ephemeral ports. Use to validate work end-to-end without touching shared infra.
---

# Stack (local e2e lane)

One command gives an agent the full Notifiq product, built from the code in
front of it. Nothing reaches ghost or any shared infra.

```bash
just stack-up      # build this checkout's Dockerfile, start the stack, wait healthy
just stack-url     # app / api-docs URLs (ephemeral ports)
just stack-test    # smoke: /api/v1/health + every SPA mount returns 200
just stack-logs api
just stack-down    # remove containers, network, volume, image — no residue
```

## What it is

- `docker-compose.stack.yml` — self-contained compose: `init-db` (alembic),
  `api` (uvicorn), `worker` (the job-runner polling `scheduled_jobs`). No
  external scheduler — timing lives in the sqlite volume.
- Built from **this checkout's source** — the same Dockerfile CI uses for
  release, so stack behavior predicts prod behavior (same SPA_MOUNTS, same
  image).
- `scripts/agent-stack.sh` — derives the compose project + image tag from the
  worktree directory name (`notifiq-e2e-<dir>`), generates `.env.stack` with
  ephemeral keys (gitignored), waits on `/api/v1/health`.
- Ports are docker-assigned ephemeral (`127.0.0.1::PORT`) — concurrent
  worktree stacks can't collide. Each stack gets its own sqlite volume;
  `stack-down` removes it.
- One port is published: api `8000` — `just stack-url` prints it. api↔db and
  worker↔db traffic stays inside the compose network / shared volume.

## Isolation contract

- Works identically in the main checkout (`notifiq-e2e-soonish`) and in
  `../notifiq-worktrees/<name>` (`notifiq-e2e-<name>`).
- Secrets in `.env.stack` are throwaway; regenerate by deleting the file and
  re-running `stack-up`.
- `stack-down` also removes the image. Pass `--keep-image` to skip rebuilds
  across up/down cycles on an unchanged Dockerfile.

## Validating work against the stack

- `just stack-test` is the floor: health + front door + `/docs` + all 9 SPA
  mounts.
- For deeper checks, hit the stack directly — register a user
  (`POST /api/v1/users/register`), create a channel/event, drive it with the
  same `curl` transcripts you'd put in a proof manifest. Scheduled work is
  rows in sqlite — inspect with:
  `docker compose -f docker-compose.stack.yml -p <project> exec api uv run
  python -c "import sqlite3; c=sqlite3.connect('/data/notifiq.db');
  print(c.execute('select kind,status,due_at from scheduled_jobs').fetchall())"`
- Note: `API_BASE_URL`/email links point at `localhost:8000` internally —
  cosmetic inside the lane; absolute URLs in outbound mail won't match the
  ephemeral port.

## The `notifiq` CLI

`backend/src/cli/` is a typer+rich client (`uv run notifiq` inside `backend/`)
— the thin authenticated-API-client pattern for poking any stack (local
lane, prod, or someone else's). Auth: `notifiq login -e <email> -p <pass>
-u <stack-url>` → token saved to `~/.config/notifiq/config` (or
`NOTIFIQ_BASE_URL`/`NOTIFIQ_TOKEN` env).

- **DEV_MODE shortcut**: the stack provisions `admin@example.com` with no
  password — `notifiq login -e admin@example.com -p anything -u
  http://localhost:<port>` is the fastest agent login (verified already).
- Newly registered users need email verification; with no SMTP in the lane,
  flip it directly:
  `docker compose -f docker-compose.stack.yml -p <project> exec api uv run
  python -c "import sqlite3; con=sqlite3.connect('/data/notifiq.db');
  con.execute(\"UPDATE users SET is_verified=1 WHERE email='<e>'\");
  con.commit()"`
- Surface: `notify`, `events list|create|show|delete`, `channels
  list|create|delete`, `whoami`, `config show|init`, `login`.

## Gotchas

- First build is slow (npm ci + vite build × 10 frontends); layer cache makes
  later builds fast, and two worktrees at the same commit share it.
- `FRONTEND_APPS` subsets don't work — the Dockerfile's runtime stage copies
  every app's `dist/` regardless (build failure, not missing pages).
- `stack-up` in a worktree whose branch predates the stack lane → merge or
  cherry-pick `main` first (the justfile + script + compose file must be in
  the worktree).
- Do not publish ports beyond loopback; the stack has no auth hardening.
