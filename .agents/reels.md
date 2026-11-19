# PR reels (psychopomp)

Every PR ships with a narrated motion-graphics reel — rendered and voiced
entirely locally. Example: PR #29 (`notifiq-ci-stack.mp4`).

## Making one

Scene Programs live in `~/projects/personal/psychopomp/scenes/` (local clone,
never pushed). Load the `psychopomp` + `explainer-motion` skills there for
the full workflow; the short version:

1. `scenes/notifiq-<slug>/` — copy `scenes/digital-harbor-intro`
   (`Cargo.toml` + `src/main.rs`).
2. Script 3-4 beats (~30s). Voice: `Voice::say("kokoro:am_onyx")` (deep,
   neutral — the house default). Never `cbclone:me`: it is the owner's
   cloned voice and reads uncanny-valley to them. Each beat
   needs a transcript-stable anchor word — verify against the generated
   `media.lock.json` words after generation (whisper splits "backend"→
   "back end", renders "twelve"→"12"; `normalize()` folds case/punctuation).
3. `PATH=~/.local/bin:$PATH cargo +stable run -p psychopomp-<slug>` → plan +
   narration mp3s.
4. `plan validate`, `plan snapshot <plan> <times> /tmp/frames --theme harbor`
   — eyeball every beat before rendering.
5. Render (GPU env is required — llvmpipe is ~45x slower):
   `VK_ICD_FILENAMES=~/nvidia-595/vk/nvidia_icd.json LD_LIBRARY_PATH=~/nvidia-595/vk
   cargo +stable run --release -- plan render <plan> output/<slug>.mp4 --theme harbor`
6. Verify: ffprobe (1920x1080@60, aac) + `volumedetect` (speech ~-19dB mean).

## Conventions

- ~30s max; harbor theme; orb = the PR, cards = what it touches; statuses
  `queued → green`; end card `nic/notifiq · pr N`.
- Commit the scene to the local psychopomp clone.
- Attach to the PR: upload mp4 via `POST /repos/nic/notifiq/issues/<pr>/assets`,
  comment with a `**[name.mp4](url)**` link (Forgejo renders the player).
- Archive: `rsync -av output/<slug>.mp4 ghost:/tank/encrypted/nas/media/reels/`
  → browsable at reels.paynepride.com.
