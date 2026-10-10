# Proof: agent/pr-reels

**Claim:** the PR-reel convention is now documented where agents find it —
`.agents/reels.md` (workflow + conventions), routed from `.agents/README.md`
and AGENTS.md's PR workflow. Demonstrated live: PR #29 carries
`notifiq-ci-stack.mp4` (33s narrated reel, uploaded as an issue asset +
archived at reels.paynepride.com).

## Evidence

```console
$ ls .agents/
README.md  ci.md  forgejo.md  reels.md  validation.md
```

- `.agents/reels.md` — end-to-end recipe: scene scaffold, script anchors
  (incl. the whisper quirks hit making the #29 reel), GPU env, attach path.
- AGENTS.md PR workflow step 4 now says: proof manifest + narrated reel.
- First reel delivered on PR #29 comment — Forgejo asset uuid
  `cf7fd3cb…` (11.3MB mp4, 1080p60 h264+aac, verified via ffprobe +
  volumedetect).
- This PR's own reel: attached below as proof the convention scales —
  a second scene (`notifiq-pr-reels`) authored the same way.

## Not proven

- Reel quality is taste — conventions (~30s, harbor theme, orb=PR) are the
  guardrail, not a gate.
