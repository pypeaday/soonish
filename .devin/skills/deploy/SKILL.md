---
name: deploy
description: Release deploy procedure for notifiq.net — pull-based compose deploy to ghost. Run only when the user explicitly asks to deploy.
---

# Deploy (release)

Production = ghost. The stack runs the `notifiq-app:release` image built by CI;
everything deploys pull-based from the Forgejo registry
(`git.paynepride.com/nic/notifiq:{latest,sha}`).

## Preconditions

- CI `docker-build.yml` on the target commit is green (image is in the
  registry). Check runs:
  `curl -s -H "Authorization: token $TOKEN" "https://git.paynepride.com/api/v1/repos/nic/notifiq/actions/tasks"`.
- Secrets live on ghost, not in the repo: release env at
  `~/projects/personal/soonish/.env.release` (gitignored), tunnel token at
  `.deploy/tunnel.env`.

## Procedure

From this repo on aurora (docker context routes to ghost):

```bash
docker --context ghost compose --env-file .env.release \
    -f docker-compose.release.yml pull
docker --context ghost compose --env-file .env.release \
    -f docker-compose.release.yml up -d
```

(`DOCKER_HOST=ssh://ghost` + plain `docker compose` works identically.)

The api+worker restart on the new image; sqlite lives in the
`soonish_notifiq_data` volume; alembic runs via the `init-db` oneshot.
cloudflared is the separate `notifiq-edge` project (`docker-compose.yml`) and
is not touched by a release deploy.

## Verify after deploy

- `docker --context ghost ps` — `soonish-api-1` healthy, `soonish-worker-1` up
- `curl -s localhost:8000/health` (on ghost) — api + temporal + db healthy
- `https://app.notifiq.net` 200; spot-check `/<app>` mounts you changed
- Report the deployed image sha (`docker inspect --format '{{.Image}}'`)

## Gotchas

- **Never run `docker compose up`/`down` in this repo bare** — two compose
  files once shared the `soonish` project name and an edge `up` SIGTERMed
  prod api+worker. `docker-compose.yml` is named `notifiq-edge` now; keep
  edge and release commands on their own `-f` files.
- If the image didn't change, `up -d` won't recreate — `pull` first, or
  `up -d --force-recreate api worker`.
- Infra (tunnel ingress, DNS) is **not** part of deploy — it's
  `homelab-mono/infrastructure/notifiq` (`tofu apply`), and it escalates.
