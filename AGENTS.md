# Notifiq (soonish)

> **Canonical**: the live Notifiq monorepo — source of truth for all
> notifiq.net code (dir is `soonish`, remote is `nic/notifiq`).

## Model

Monorepo: a python FastAPI backend plus a family of `frontend-*` apps against
its API, deployed as a single `notifiq-app:release` image that serves the API
and every SPA via path mounts (`/mindful`, `/tasks`, ...).

- **Source of truth**: this repo on Forgejo (`ssh://git@ghost:222/nic/notifiq.git`).
- **Source of truth for infra**: `homelab-mono/infrastructure/notifiq`
  (OpenTofu, S3 state) owns the tunnel, ingress map, and notifiq.net DNS —
  `terraform/` here is legacy.
- **Deploy path**: push to `main` → `docker-build.yml` builds + pushes to the
  Forgejo registry → pull-based compose deploy on ghost. See
  `.devin/skills/deploy/SKILL.md` for the release procedure.

## Commands

The `justfile` is the canonical task interface. `just` lists all recipes.

- `just verify` — **THE gate**; run before "done" (see Verify)
- `just verify-integration` / `just verify-services` / `just verify-live` —
  narrower backend lanes (integration / outbound-sink / real-delivery cron)
- `just worktree <name>` — isolated worktree on `agent/<name>` with ephemeral
  env (`.devin/skills/` procedures build on this)
- `just stack-up` / `just stack-test` / `just stack-down` — full local e2e
  stack (Temporal + api + worker + all frontends) from this checkout's
  source, isolated per worktree; see `.devin/skills/stack/SKILL.md`
- `just proof-init` / `just proof-verify` / `just proof-check` — proof
  manifest lifecycle for PRs
- `backend/justfile` — backend-local recipes (`just test-unit`, `lint`, ...);
  `cd backend && just --list`

## Verify

**`just verify` is the one command.** Non-zero exit on any failure, labelled
summary at the end. **A PR without a proof manifest is not done** — the
change works, *and* the evidence travels with the branch.

What `just verify` runs:

- backend: `uv run ruff check` + `pytest` unit tests (integration tests
  auto-skip unless `--run-integration`)
- backend integration: `just verify-integration` → `backend/justfile
  test-full`: ephemeral `temporal server start-dev` + fresh sqlite + free
  ports. Runs automatically when the `temporal` CLI is on PATH; otherwise a
  loud `NOTE ... NOT RUN`, never a fake pass.
- service lane: `test-full` also starts outbound-service sinks (fake SMTP via
  `backend/scripts/sink_smtp.py`); `-m service` tests prove a notification
  really left the app. Refuses non-local `SMTP_HOST`.
- live lane: real delivery, daily cron only, never on PRs (`just
  verify-live`, needs `GOTIFY_*`/`SMTP_*`/`TEST_*` secrets).
- frontends: `npm ci` + `npm run lint` + `npm run build` for every
  `frontend-*/`. Narrow with `VERIFY_FRONTENDS="frontend-mind"` or `none`.
  `npm run build` is the hard gate; eslint is advisory (main has ~75
  pre-existing findings). For an app you touched, hold the stricter bar:
  `VERIFY_LINT_STRICT=1 VERIFY_FRONTENDS=<app> just verify`.

### The PR workflow

1. **Worktree** — `just worktree <name>` → `../notifiq-worktrees/<name>` on
   `agent/<name>`, ephemeral keys, `TEMPORAL_URL=localhost:7233`, unique task
   queue. Concurrent agents don't collide.
2. **Change** — smallest diff that does the job (see `backend/AGENTS.md`).
3. **Proof** — `just proof-init` creates `proof/<branch-slug>.md`; one
   evidence block per claim via `./scripts/proof exec bash "<command>"`;
   `just proof-verify` last.
4. **PR** — commit `proof/<slug>.md` with the change + attach a narrated
   reel (`.agents/reels.md`). CI (`.forgejo/workflows/verify.yml`) runs
   `just verify` and `proof-check`.

Evidence is change-scoped (curl transcript, build output, workflow id), real
and unedited (`scripts/proof` wraps `uvx showboat`); what you couldn't run
goes under "Not proven". Template and full rules: `PROOF.example.md`.

## Map

- `backend/` — FastAPI service (alembic, HTMX + Alpine admin UI). Has its own
  `AGENTS.md` — read it for backend work. Requires Temporal.
- `backend/src/api/` — routes/services; `backend/src/telemetry.py` — OTEL
  init + `apprise_notify`/`apprise_anotify` span wrappers.
- `backend/src/worker/` — Temporal worker (same image, worker entrypoint).
- `frontend-<name>/` — one standalone SPA per product (12 today), all
  consuming `notifiq.openapi.json` as the API contract.
- `backend/src/cli/` — the `notifiq` typer CLI (thin authenticated API
  client; `uv run notifiq` inside `backend/`); see stack skill for usage.
- `scripts/` — `agent-worktree.sh`, `proof`, `check-proof.sh`.
- `proof/` — per-branch proof manifests; `PROOF.example.md` is the template.
- `.agents/` — agent knowledge base (routing page: `.agents/README.md`) —
  validation lanes, Forgejo API cookbook, CI/DinD topology. Reference docs;
  executable procedures stay in `.devin/skills/`.
- `docs/` — human-facing docs (API usage, self-hosting).
- `docker-compose.release.yml` — prod-shaped release compose (api+worker,
  external `temporal-network`/`phantomlink`); `docker-compose.yml` is the
  `notifiq-edge` cloudflared project only; `docker-compose.stack.yml` is the
  self-contained local e2e stack.
- `.forgejo/workflows/` — `docker-build.yml` (image→registry), `verify.yml`
  (PR gate), `live-delivery.yml` (daily cron), `mirror.yml`, `gh-pages.yml`
  (pre-existing failure).
- `terraform/` — LEGACY pype.dev IaC, not live (see Model).

## Bounds

- **Never deploy** from a worktree or on your own initiative; the release
  procedure in `.devin/skills/deploy/SKILL.md` runs only when asked.
- **Never commit** secrets: `.env*` files, `stripe.gpg` decrypted, tokens,
  `seed.sql`-style dumps. Mint your own Forgejo token per Issue board.
- **Never point** tests/verify at `ghost:7233` (shared prod Temporal) — the
  harness refuses non-local `TEMPORAL_URL`; don't bypass it.
- **Don't run `docker compose up` in this repo** against ghost without the
  compose project names straight — `docker-compose.yml` is `notifiq-edge`
  (cloudflared) and bare compose commands once SIGTERMed prod api+worker.
- Billing is dormant (`BILLING_ENABLED=false`), not dead — don't strip Stripe
  code or wire new UI to `/billing/*`; escalate product decisions on the
  issue board (`needs-decision`).
- Destructive or shared-infra changes (tofu apply on live infra, DNS, tunnel
  ingress) escalate to the human.

## Report

A finished turn reports: **state** (what changed, where it stands — branch,
worktree, deployed?), **verification** (`just verify` result + proof manifest
path or the precise gap), and **Next** (the single obvious follow-up).

## Gotchas

- Remote is `ssh://git@ghost:222/nic/notifiq.git` (repo name differs from
  dir). If push fails on the key:
  `GIT_SSH_COMMAND='ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes' git push`.
- Default DB is sqlite `notifiq.db`; postgres path is
  `docker-compose.postgres.yml` (`POSTGRES_MIGRATION.md`).
- `pytest` inside `backend/` (its `pytest.ini` lives there).

## Product direction

- notifiq.net is planned as a paid product **and/or** the owner's personal
  infra for all their apps. Open-sourcing the codebase is intended.
- Billing was deliberately removed: `BILLING_ENABLED=false`, all users are
  `tier="free"`. Stripe code, `billing.py` routes, tier fields, and checkout
  UI remain — dormant, not dead.
- "Free user" labels: show `is_admin` badge instead of tier for admins.

## Issue board (agent coordination)

Work is tracked on the Forgejo issue tracker: `nic/notifiq` → Issues.
Labels: `app:<name>`, `kind:ship-pass|bug|polish`, `needs-decision`.

- Check the board before starting work; claim by commenting/self-assigning.
- API: `https://git.paynepride.com/api/v1/repos/nic/notifiq/issues`
- Token: generate your own — `ssh ghost "docker exec forgejo forgejo admin
  user generate-access-token --username nic --token-name <agent-name>"` —
  never commit tokens.
