#!/usr/bin/env bash
# Gate: a PR without a proof manifest is not done.
#
#   scripts/check-proof.sh [base-ref]      # default base: $GITHUB_BASE_REF or main
#
# Passes only when this branch adds at least one file under proof/ vs the base
# branch (one proof/<branch-slug>.md per change, so open PRs never conflict on
# the same file) and every new manifest has no leftover template placeholders.
# Used by .forgejo/workflows/verify.yml and runnable locally (`just proof-check`)
# so the agent can self-check before opening the PR.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
BASE="${1:-${GITHUB_BASE_REF:-main}}"

# Prefer the remote ref (that's what CI compares against), fall back to local.
if git rev-parse --verify --quiet "origin/$BASE" >/dev/null; then
    BASE_REF="origin/$BASE"
elif git rev-parse --verify --quiet "$BASE" >/dev/null; then
    BASE_REF="$BASE"
else
    echo "FAIL: cannot resolve base ref '$BASE' (tried origin/$BASE and $BASE)."
    exit 1
fi

# Manifests this branch adds under proof/.
NEW_PROOFS="$(git diff --name-only --diff-filter=A "$BASE_REF...HEAD" -- 'proof/*.md')"
if [ -z "$NEW_PROOFS" ]; then
    echo "FAIL: no new proof/<slug>.md added vs $BASE_REF."
    echo "      Run 'just proof-init' and build the manifest — see AGENTS.md > Verify."
    exit 1
fi

# Catch a template that was committed without being filled in. Only prose lines
# count: captured output legitimately quotes placeholder text (e.g. proof that
# this very check works), so fenced code blocks are excluded.
rc=0
while IFS= read -r proof_file; do
    [ -f "$proof_file" ] || continue
    PROSE="$(awk '/^```/{fence=!fence; next} !fence' "$proof_file")"
    if printf '%s\n' "$PROSE" | grep -nF -e '<real captured output' -e '<exact command>' \
            -e '<one line describing the change>' -e '<restate it>'; then
        echo "FAIL: $proof_file still contains template placeholders (shown above)."
        rc=1
    fi
done <<< "$NEW_PROOFS"
[ "$rc" -eq 0 ] || exit 1

echo "OK: proof manifest(s) added in this branch vs $BASE_REF:"
git diff --stat "$BASE_REF...HEAD" -- 'proof/*.md'
