# Proof: agent/reel-voice

**Claim:** `.agents/reels.md` now names `kokoro:am_onyx` the house voice and
forbids `cbclone:me` (owner's clone — reads uncanny). The two delivered
reels were re-voiced and re-published.

## Evidence

- `grep am_onyx .agents/reels.md` — default + warning in place.
- `notifiq-ci-stack.mp4` (29.9s) + `notifiq-pr-reels.mp4` (15.1s) re-rendered
  with `Voice::say("kokoro:am_onyx")`, re-uploaded to PRs #29/#31 (comments
  updated in place), re-rsynced to reels.paynepride.com.
- Anchor quirk found and fixed: kokoro transcribes "hostname" as one word;
  cbclone split it. Documented pattern already in reels.md.

## Not proven

- Voice taste — the owner picked am_onyx from three same-line samples at
  reels.paynepride.com/voice-samples/.
