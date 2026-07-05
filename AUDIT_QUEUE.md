# wubflipz — AUDIT QUEUE

Items that need **human by-ear / by-eye verification**. Autonomous build logs them
here instead of pausing. Nothing here is self-certified. Check the box once a human
has verified it in a real browser with real audio.

Legend: `[ ]` unverified · `[x]` verified by human · `(EARS)` needs listening ·
`(EYES)` needs visual check · `(STRESS)` needs a real large/long file.

---

## Bugfixes

- [x] (EARS) **Emergency Stop / Stop leak** — with a sample loaded, a Quick Split preview
      playing, multiple Lanes playing, and at least one synth note ringing/releasing,
      confirm regular Stop controls silence their sections and the red **Emergency Stop**
      silences **everything** immediately. Check both regular Stop and Emergency Stop
      separately in a real browser. Closed from user report that everything sounds good;
      code/smoke re-check also confirmed Stop-All still includes Synth/Sample/Lanes/Stems
      before Sequencer work began.
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
      from a short clip. HPSS stores only the magnitude spectrogram (~115 MB for 5 min)
      + recomputes complex per frame, processed in time-chunks with yields — but peak
      memory on a real long file is unverified. NOTE: implemented as chunked manual
      STFT (not OfflineAudioContext); verify memory on a real 5-min track.

## Stage 4 — lanes
- [ ] (EARS) All lanes play in sample-accurate sync against one clock (no drift/flam).
- [ ] (EARS) Per-lane volume / pan / mute / solo behave correctly.
- [ ] (EYES) Lane waveforms and shared playhead line up.

## Stage 5 — detection
- [ ] (EARS/EYES) Detected BPM on a **real track** is reasonable and auto-populates the
      Wobble BPM field; user can override it. (Synthetic 140-BPM click → 140.00 BPM: PASS.
      Real music with syncopation/octave ambiguity still needs a check.)
- [ ] (EYES) Beat-grid lines land on audible beats on a real track; loop/playhead snap
      to grid feels right.
- [ ] (EARS/EYES) Detected key on a **real track** is plausible and editable. (Synthetic
      C-major chord → "C major" r=0.63: PASS. Real mixes need a check.)

## Step Sequencer / Drum Pad
- [ ] (EARS) Factory preset pack covers useful modern dubstep sub-styles by ear and
      each preset's sequencer pattern feels appropriate to the patch.
- [ ] (EARS) Default synthesized kit sounds musically usable by ear: kick, snare, clap,
      hats, tom, rim, and crash have useful character.
- [ ] (EARS/EYES) Sync mode locks the sequencer to the Wobble BPM in real time, including
      live BPM changes mid-playback and Stage 5 tempo auto-fill.
- [ ] (EARS) Drums do **not** wobble or duck under heavy Wobble+Growl synth settings, and
      the synth does not duck under a busy drum pattern.
- [ ] (EARS) Stop-All silences a playing sequencer pattern + ringing synth note + Quick
      Split preview + Sample/Lanes playback simultaneously. This extends the old
      four-path check to the new fifth playback path.
- [ ] (EARS) Per-pad uploaded samples sound and time correctly with level/pitch controls.

## Wobble Match
- [ ] (EARS) Match Wobble from Track produces musically sensible Wobble/Growl starting
      points on a real uploaded dubstep track. Synthetic rate recovery passing does not
      validate real full-mix accuracy.

## Sound Fuzzer
- [ ] (EARS) Generated variants sound like plausible, usable dubstep patches rather than
      random parameter noise. Headless checks prove bounds only; the mutation table still
      needs by-ear tuning if results are too chaotic or too conservative.

## Polish P1 — visual / interaction pass
- [ ] (EARS/EYES) P1 by-ear/by-eye pass — step pulse feels tight to the beat at 140 and
      174 BPM; meters track loudness believably; noise floor is subtle not distracting;
      key flash latency is imperceptible.
