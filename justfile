# Notifiq monorepo — the single entry point an agent uses to prove its work.
#
#   just verify                              # baseline proof: backend + every frontend
#   VERIFY_FRONTENDS="frontend-website" just verify
#   VERIFY_FRONTENDS=none just verify        # backend only
#   just verify-integration                  # backend integration suite (needs temporal CLI)
#
# See AGENTS.md "Verify" for the full agent contract.

default:
    @just --list

# ---------------------------------------------------------------- verify ----

# The baseline proof every change owes. Non-zero exit if anything fails.
verify:
    #!/usr/bin/env bash
    set -uo pipefail
    FAILED=()
    PASSED=()
    NOTES=()
    record() {
        local name="$1"; shift
        echo ""
        echo "######## $name"
        if "$@"; then PASSED+=("$name"); else FAILED+=("$name"); fi
    }

    record "backend lint"  just verify-backend-lint
    record "backend tests (unit)" just verify-backend-tests

    # Integration tests need an ephemeral Temporal. Run them when the CLI is
    # here; otherwise say so loudly instead of pretending they passed.
    if command -v "${TEMPORAL_CLI:-temporal}" >/dev/null 2>&1; then
        record "backend tests (integration)" just verify-integration
    else
        NOTES+=("backend tests (integration): NOT RUN — no 'temporal' CLI on PATH. Run 'just verify-integration' to see the exact failure.")
    fi

    VERIFY_LINT_REPORT="$(mktemp)"
    export VERIFY_LINT_REPORT
    trap 'rm -f "$VERIFY_LINT_REPORT"' EXIT
    for app in $(just _frontend-list); do
        record "$app" just verify-frontend "$app"
    done
    if [ "${VERIFY_FRONTENDS:-all}" != "all" ]; then
        NOTES+=("frontends: only VERIFY_FRONTENDS='${VERIFY_FRONTENDS}' were checked.")
    fi
    if [ -s "$VERIFY_LINT_REPORT" ]; then
        NOTES+=("eslint findings (advisory, pre-existing on main): $(tr '\n' ' ' < "$VERIFY_LINT_REPORT")")
        NOTES+=("    -> VERIFY_LINT_STRICT=1 VERIFY_FRONTENDS=<app> just verify  makes lint blocking")
    fi

    echo ""
    echo "================ verify summary ================"
    for n in "${PASSED[@]:-}"; do [ -n "$n" ] && echo "  PASS  $n"; done
    for n in "${FAILED[@]:-}"; do [ -n "$n" ] && echo "  FAIL  $n"; done
    for n in "${NOTES[@]:-}"; do [ -n "$n" ] && echo "  NOTE  $n"; done
    echo "==============================================="
    if [ "${#FAILED[@]}" -gt 0 ]; then
        echo "verify FAILED (${#FAILED[@]} step(s))"
        exit 1
    fi
    echo "verify PASSED (${#PASSED[@]} step(s))"

verify-backend-lint:
    cd backend && just lint

# Unit tests only; integration tests are auto-skipped by backend/tests/conftest.py.
# No services, no ports, sqlite db is per-directory so worktrees are isolated.
verify-backend-tests:
    #!/usr/bin/env bash
    set -euo pipefail
    cd backend
    # Never let an inherited/.env TEMPORAL_URL point a test at shared prod.
    export TEMPORAL_URL="localhost:7233"
    export DEBUG=true
    just test-unit

# Backend integration suite: ephemeral Temporal + fresh sqlite + free ports.
# Fails loudly (does not skip) when the temporal CLI is missing.
verify-integration:
    cd backend && just test-full

# Only the service lane: tests proving a notification really left the app via
# an outbound sink (fake SMTP today; scripts/sink_*.py). Same boots as above.
verify-services:
    cd backend && just test-services

# Live lane: real outbound delivery (gotify read-back, email, sms->carrier).
# Needs secrets in env — see .forgejo/workflows/live-delivery.yml. Runs in the
# daily CI cron, NOT on PRs. Locally: backend/.env must carry real SMTP_*.
verify-live:
    #!/usr/bin/env bash
    set -euo pipefail
    cd backend
    if [ -z "${GOTIFY_APP_TOKEN:-}${TEST_EMAIL:-}${TEST_PHONE:-}" ]; then
        echo "verify-live: no live secrets set (GOTIFY_*, TEST_EMAIL, TEST_PHONE)."
        echo "This lane sends REAL notifications — intended for the daily cron."
        exit 0
    fi
    uv run pytest tests/test_live_delivery.py -m live --run-live -v

# npm ci + lint + build for the selected frontend apps.
verify-frontends:
    #!/usr/bin/env bash
    set -uo pipefail
    rc=0
    for app in $(just _frontend-list); do
        just verify-frontend "$app" || rc=1
    done
    exit $rc

# npm ci + lint + build for one app. `npm run build` (tsc -b && vite build) is the
# hard gate. eslint is advisory by default: main is already red (~75 findings
# across 9 apps, see AGENTS.md > Verify), so a blocking lint would fail every PR
# for reasons unrelated to its change. Set VERIFY_LINT_STRICT=1 to make lint
# blocking — do that for the app you actually touched.
verify-frontend app:
    #!/usr/bin/env bash
    set -euo pipefail
    cd "{{ app }}"
    echo "--> {{ app }}: npm ci"
    npm ci --no-audit --no-fund
    if node -e "process.exit(require('./package.json').scripts.lint ? 0 : 1)"; then
        echo "--> {{ app }}: npm run lint"
        if ! npm run lint; then
            if [ "${VERIFY_LINT_STRICT:-0}" = "1" ]; then
                echo "--> {{ app }}: LINT FAILED (VERIFY_LINT_STRICT=1)"
                exit 1
            fi
            echo "--> {{ app }}: lint findings above (advisory — not failing the run)"
            if [ -n "${VERIFY_LINT_REPORT:-}" ]; then echo "{{ app }}" >> "$VERIFY_LINT_REPORT"; fi
        fi
    else
        echo "--> {{ app }}: no lint script, skipping lint"
    fi
    echo "--> {{ app }}: npm run build"
    npm run build

# Frontend dirs to verify. Honours VERIFY_FRONTENDS (space/comma separated, or
# "all" / "none"). Default: all.
_frontend-list:
    #!/usr/bin/env bash
    set -euo pipefail
    sel="${VERIFY_FRONTENDS:-all}"
    if [ "$sel" = "none" ]; then exit 0; fi
    if [ "$sel" = "all" ]; then
        for d in frontend-*/; do
            [ -f "${d}package.json" ] && echo "${d%/}"
        done
        exit 0
    fi
    for d in ${sel//,/ }; do
        d="${d%/}"
        if [ ! -f "$d/package.json" ]; then
            echo "VERIFY_FRONTENDS names '$d' but $d/package.json does not exist" >&2
            exit 1
        fi
        echo "$d"
    done

# ----------------------------------------------------------------- proof ----

# Start proof/<branch-slug>.md for the current branch from the template.
# One manifest per branch, so open PRs never conflict on the same file.
proof-init:
    #!/usr/bin/env bash
    set -euo pipefail
    slug="$(basename "$(git rev-parse --abbrev-ref HEAD)")"
    mkdir -p proof
    file="proof/${slug}.md"
    if [ -f "$file" ]; then echo "$file already exists"; exit 1; fi
    # Drop the <!-- instructions --> blocks; they live in PROOF.example.md.
    awk '/<!--/{skip=1} !skip; /-->/{skip=0}' PROOF.example.md > "$file"
    echo "$file created from PROOF.example.md — fill in the claims, then use scripts/proof"
    echo "(instructions stay in PROOF.example.md)"

# Append the baseline `just verify` run to proof/<branch-slug>.md as evidence.
proof-verify:
    ./scripts/proof exec bash "just verify"

# The gate CI applies to a PR: a new proof/<slug>.md vs base, no placeholders.
proof-check base="main":
    ./scripts/check-proof.sh "{{ base }}"

# -------------------------------------------------------------- worktree ----

# Bootstrap an isolated agent worktree: just worktree my-change
worktree name:
    ./scripts/agent-worktree.sh "{{ name }}"

# ---------------------------------------------------------------- stack ----
# Isolated full-stack e2e lane for this checkout/worktree: embedded Temporal +
# init-db + api + worker + all built frontends, on ephemeral localhost ports.
# Nothing touches ghost or shared infra. See .devin/skills/stack/SKILL.md.

# Build from this checkout's source and start the stack; waits for /health.
stack-up:
    ./scripts/agent-stack.sh up

# Smoke test the running stack (health + every SPA mount).
stack-test:
    ./scripts/agent-stack.sh test

# Print the stack's URLs.
stack-url:
    ./scripts/agent-stack.sh url

# Tail logs for all services or one: just stack-logs api
stack-logs *svc:
    ./scripts/agent-stack.sh logs {{ svc }}

# Stop and remove containers, network, sqlite volume, and the image.
stack-down *args:
    ./scripts/agent-stack.sh down {{ args }}
