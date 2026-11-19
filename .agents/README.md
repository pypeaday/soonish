# .agents/ — agent knowledge base

Reference docs for agents working on Notifiq. **Start at `AGENTS.md`** (repo
root) — it has the rules. This directory is the map for everything that
doesn't fit there. Human-facing docs live in `docs/` instead.

## I need to…

| Task | Go to |
|---|---|
| Pick which validation lane to run (verify / stack / proof) | [validation.md](validation.md) |
| Run the whole product locally in this worktree | `.devin/skills/stack/SKILL.md` |
| Create a PR, attach screenshots, read CI status/logs | [forgejo.md](forgejo.md) |
| Make + attach the narrated PR reel | [reels.md](reels.md) |
| Understand how CI executes (DinD topology, runner) | [ci.md](ci.md) |
| Use the HTTP API / `notifiq` CLI against a stack | `docs/api.md`, `.devin/skills/stack/SKILL.md` |
| Deploy to production | `.devin/skills/deploy/SKILL.md` — only when asked |
| Do backend work | `backend/AGENTS.md` first |

## Conventions

- One topic per file; keep commands copy-pasteable and verified.
- Facts beat prose — if a claim can't be run or shown, say so.
- Screenshots and proof-of-work go in `proof/`, not here.
- When you learn something a later agent will need (topology, a gotcha, an
  API quirk), add or update the matching page — don't leave it in chat.
