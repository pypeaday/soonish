# Proof: <one line describing the change>

<!--
HOW TO USE THIS TEMPLATE

Scheme: ONE manifest PER BRANCH, at `proof/<branch-slug>.md` (the slug is the
branch name's last path segment: feat/agent-x -> proof/agent-x.md). A shared
PROOF.md made every open PR conflict on the same file, so each change owns
its own manifest under proof/ instead. `just proof-init` copies this template
to the right path; fill it in and commit it with the change. Old manifests
stay in proof/ after merge — they are the record of what was proven. CI
checks "a new proof/*.md was added in this PR" with a git diff.

Build it with the helper so the outputs are real and re-runnable:

    just proof-init                                   # this template -> proof/<slug>.md
    ./scripts/proof note "Claim: ..."                 # commentary
    ./scripts/proof exec bash "<command>"             # runs it, records output
    just proof-verify                                 # appends `just verify`
    ./scripts/proof verify                            # re-runs every block, diffs

Rules for evidence:
  * Paste REAL output. Never hand-write, trim, or beautify it. If it's ugly,
    that's the point.
  * Evidence must be scoped to THIS change, not just the baseline:
      - new/changed API route  -> curl transcript: request + status + body
      - frontend change        -> `npm run build` output (+ screenshot if visual)
      - temporal workflow      -> workflow id + `temporal workflow show` trace
      - bug fix                -> the failing command BEFORE, the same one AFTER
      - data model change      -> the query/script output showing the new shape
  * Anything you could not run belongs in "Not proven" with the reason. An
    honest gap beats a fake pass.
  * The baseline `just verify` block goes LAST, so a reviewer reads claims
    first and the global green at the end. It is long (~1000 lines with all
    frontends); that's fine. If you must shorten it, record
    `just verify 2>&1 | tail -n 40` — the summary block has to survive intact.
-->

## Change

<!-- 2-4 sentences: what changed and why. Link the issue: nic/notifiq#NN. -->

## Claims

<!-- Numbered, each one independently checkable. One evidence block per claim. -->

1.
2.

## Evidence

### Claim 1: <restate it>

```bash
<exact command>
```

```output
<real captured output>
```

### Claim 2: <restate it>

```bash
<exact command>
```

```output
<real captured output>
```

## Not proven

<!--
Be precise. "Untested" with no reason is not acceptable.
e.g. "Integration suite NOT RUN: no `temporal` CLI in this environment
(`which temporal` -> empty). Needs a human or CI run with the CLI present."
-->

-

## Baseline

The proof every change owes, regardless of what it touched.

```bash
just verify
```

```output
<real captured output of just verify>
```
