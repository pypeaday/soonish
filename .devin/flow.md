**Goal:** Deploy notifiq to ghost behind Cloudflare with a repeatable release flow, then ship products.
**Now:** DONE — app live at https://app.notifiq.net, images in Forgejo registry. Next: products/features work.
**Done:**
- Pushed 40 commits total to Forgejo (recovered work + deploy fixes)
- Built notifiq-app:release on ghost via `docker --context ghost compose build`
- Deployed: init-db (alembic OK), api (healthy), worker (on notifiq-task-queue) — project `soonish`, reuses soonish_notifiq_data volume
- cloudflared running as project `notifiq-edge` (tunnel e666df98) — app.notifiq.net live end-to-end
- CF verified: apex/www serve Pages site (200), Resend/DMARC DNS applied
- Release env at ~/projects/personal/soonish/.env.release (gitignored); tunnel token at .deploy/tunnel.env
- CI now builds+pushes to Forgejo registry: git.paynepride.com/nic/notifiq:{latest,sha} (FORGEJO_TOKEN repo secret)
- Verified pull-based deploy: stack running git.paynepride.com/nic/notifiq:latest
**Parked:**
- Repoflow abandoned (license expired) — replaced by Forgejo registry; unused narrow-scope forgejo token `notifiq-ci` can be revoked
- Resend API key needed for outbound email (SMTP_* commented in .env.release)
- Dev/staging environment, Stripe billing, remote/soonish/mindful tunnel hostnames (no services yet)
- Release: push to main → CI builds image → `docker --context ghost compose --env-file .env.release -f docker-compose.release.yml pull && up -d` (local --build also works)
**Decisions:**
- Deploy model: compose from desktop against ghost context; cloudflared in separate compose project to avoid orphan removal
- Temporal via shared `temporal-network` (temporal:7233); API bound to 127.0.0.1:8000
- Old `users`-table crash was an empty/unmigrated volume — alembic init fixed
