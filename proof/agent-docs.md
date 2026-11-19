# Proof: agent/agent-docs

**Claim:** repo docs are now organized for two audiences — `.agents/` routes
agents to topic docs (validation, Forgejo API, CI topology), `docs/` holds
human-facing docs (API usage, self-hosting). AGENTS.md's Map points at both.

## Evidence

```console
$ find .agents docs -name '*.md' | sort
.agents/README.md
.agents/ci.md
.agents/forgejo.md
.agents/validation.md
docs/README.md
docs/api.md
docs/self-hosting.md
```

Every file referenced by the new docs was existence-checked in this checkout
(`backend/POSTGRES_MIGRATION.md` link corrected during review — it lives
under `backend/`). Content is distilled from verified session work, not
aspirational:

- `.agents/ci.md` — DinD topology + `docker-in-docker.docker.internal`
  hostname + `.zst` job-log paths, all discovered debugging PR #29.
- `.agents/forgejo.md` — POST-not-PUT merge, asset upload endpoint, token
  scopes: all hit live against this instance.
- `docs/api.md` — endpoints/fields cross-checked against
  `backend/src/api/routes/*` prefixes + `notifiq.openapi.json`.

## Not proven

- Docs accuracy is reviewed, not executable — readers apply judgment.
