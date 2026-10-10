# Choosing a validation lane

Four lanes, cheapest → most complete. Run the cheapest lane that exercises
your change; `just verify` is the named gate before "done" regardless.

| Lane | Command | Proves | Cost |
|---|---|---|---|
| Backend unit | `cd backend && just test-unit` (+ `lint`) | logic | seconds |
| Integration | `just verify-integration` | API+Temporal+sqlite, real workflows | ~1min |
| Baseline gate | `just verify` | all of the above + every frontend build | ~5-10min |
| E2E stack | `just stack-up` + `just stack-test` | real product: api, worker, embedded Temporal, all SPAs | ~2-8min |

## Decision guide

- **Backend-only change** → `verify` (frontends can narrow:
  `VERIFY_FRONTENDS=none`).
- **Frontend change** → `verify` with `VERIFY_FRONTENDS=<app>`
  (`VERIFY_LINT_STRICT=1` if you touched it), plus `stack-up` if behavior
  needs a live API.
- **Behavior/workflow change** → `stack-up`, drive it (curl, `notifiq` CLI,
  or headless browser), record evidence in the proof manifest.
- **CI/harness change** → the PR itself is the test: `verify.yml` jobs run
  on the PR. Note in the manifest what only CI can prove.

## Headless-browser pattern

SPAs are token-gated; inject the token into `localStorage` after login via
the API. **One key repo-wide** — `auth_token` (normalized in #40).

Playwright's cached Chromium on this host:
`/home/nic/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome` —
pass as `executable_path` (the headless-shell variant isn't installed).
Example script + shots: PR #28, `proof/assets/prove-agent/`.

## PR evidence

`just proof-init` → `scripts/proof exec bash "<cmd>"` per claim →
`just proof-verify` → commit. `proof-check` gates PRs in CI. Template:
`PROOF.example.md`; a full example: `proof/prove-agent.md`.
