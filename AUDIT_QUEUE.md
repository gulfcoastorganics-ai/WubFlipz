# wubflipz — AUDIT QUEUE

Items that need **human by-ear / by-eye verification**. Autonomous build logs them
here instead of pausing. Nothing here is self-certified. Check the box once a human
has verified it in a real browser with real audio.

Legend: `[ ]` unverified · `[x]` verified by human · `(EARS)` needs listening ·
`(EYES)` needs visual check · `(STRESS)` needs a real large/long file.

---

## Bugfixes

- [ ] (EARS) **BUGFIX A** — final safety brickwall (`outCeiling`, thr −1 dB) reads
      **0.0 dB** on the "Comp GR top/sub/out" meter at normal playing levels, and the
      sub does **not** wobble under a heavy Wobble+Growl preset on a low note. Confirm
      `top` swings while `sub` and `out` stay ~0. (Traced + modeled to 0.00 dB; graph
      has no shared downstream compressor. Needs a real listen.)
- [ ] (EARS) **BUGFIX A** — sub is now fully DRY (bypasses the shared waveshaper too).
      Confirm the sub still sits well in the mix without saturation; if it's too weak on
      small speakers, we add a dedicated *steady* sub saturator (flagged in STATUS_LOG).
- [x] (EYES) **BUGFIX B** — on-screen keyboard renders keys. *Verified headlessly:*
      `#keys` builds 25 elements (15 white + 10 black). Re-confirm visually in browser.
- [x] (EARS→partial) **BUGFIX B** — computer keys trigger notes. *Verified headlessly:*
      simulated `A` keydown drove voiceCount 0→1. Still (EARS) to confirm actual sound.

## Stage 2 — file player
- [ ] (EARS) Uploaded audio plays back cleanly; transport play/pause/stop correct.
- [ ] (EYES) Peak waveform renders correctly and click-seek lands where clicked.
- [ ] (EYES) Loop region drag-select loops the intended range; zoom in/out behaves.
- [ ] (STRESS) Large file (50 MB+ / long track) decodes without freezing the UI.

## Stage 3 — Quick Split (DSP stems)
- [ ] (EARS) HPSS harmonic/percussive split is *plausible* (honest "Quick Split" quality,
      not implied pro separation). Artifacts expected — confirm they're acceptable.
- [ ] (EARS) Mid-side: "mid-removed" reduces center vocal; "mid-only" isolates it.
- [ ] (STRESS) **Memory** — run on a real 5+ minute track and watch peak memory; this
      is the 2.7 GB-ceiling environment that OOM-crashed Demucs. Do NOT assume safe
      from a short clip. Chunked OfflineAudioContext used, but verify on a long file.

## Stage 4 — lanes
- [ ] (EARS) All lanes play in sample-accurate sync against one clock (no drift/flam).
- [ ] (EARS) Per-lane volume / pan / mute / solo behave correctly.
- [ ] (EYES) Lane waveforms and shared playhead line up.

## Stage 5 — detection
- [ ] (EARS/EYES) Detected BPM is reasonable and auto-populates the Wobble BPM field;
      user can override it (never silently authoritative).
- [ ] (EYES) Beat-grid lines land on audible beats; loop/playhead snap to grid.
- [ ] (EYES) Detected key is displayed and editable; confidence shown or overridable.
