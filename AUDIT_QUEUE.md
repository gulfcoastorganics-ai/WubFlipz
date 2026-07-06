# wubflipz — AUDIT QUEUE

Items that need **human by-ear / by-eye verification**. Autonomous build logs them
here instead of pausing. Nothing here is self-certified. Check the box once a human
has verified it in a real browser with real audio.

Legend: `[ ]` unverified · `[x]` verified by human · `(EARS)` needs listening ·
`(EYES)` needs visual check · `(STRESS)` needs a real large/long file.

---

## UX Sprint 2 — workflow continuity

- [ ] (EYES) Save semantics: users can correctly explain Sound/Preset, Session/Project,
      Layout, Snapshot, Share, and JSON without documentation.
- [ ] (EYES) Dirty indicators: Sound Modified and Session Modified appear for the right
      edits, clear on the right saves, and do not appear for browser filtering/search.
- [ ] (EYES) Destructive prompts: loading a sound/session or recovering autosave warns
      when unsaved dirty state exists and does not warn when clean.
- [ ] (EYES) Workflow strip: READY/ACTIVE/COMPLETE/BLOCKED states match reality during
      Load Sound → Play → Sample → Analyze → Split → Arrange → Save/Share.
- [ ] (EYES) Feature gates: Analyze/Split/Wobble Match are disabled before sample load
      and the reason is obvious before the user gets stuck.
- [ ] (EYES) Next-step guidance: status center suggestions appear after preset load,
      sample load, analysis complete, split complete, and session save, then disappear
      without interrupting work.
- [ ] (EYES) Lanes continuity: after split, “2 stems added to Lanes” appears, Lanes is
      briefly highlighted, and Open Lanes scrolls to the correct panel.
- [ ] (EYES) Preset continuity: first launch auto-loads a factory sound and the user can
      produce sound with one keyboard/mouse action.
- [ ] (EYES) Sequencer continuity: empty-pattern guidance, hit count, and Stopped/Playing
      labels are clear and update correctly.
- [ ] (EYES) Global Status Center feels like the single source of truth rather than
      competing with local status snippets.

## UX Sprint 1 — workflow polish

- [ ] (EYES) First launch: a new user understands the intended path from the workflow
      strip within 10 seconds and the strip does not feel like a second navigation bar.
- [ ] (EYES) Compact Project panel: collapsed height feels materially smaller, core
      actions are obvious, and expanding/collapsing does not hide anything users need.
- [ ] (EYES) Workflow strip state: steps complete/highlight in the expected order after
      loading a preset, playing keys, loading a sample, analyzing, splitting, arranging,
      and saving/exporting.
- [ ] (EYES) Empty states: Sample, Analyze, Quick Split, Lanes, and User Presets teach
      the next action without adding visual clutter.
- [ ] (EYES) Autosave visibility: Saving, Autosaved + timestamp, Recovery Available,
      Recovered, and storage-failure states are understandable and noticeable enough.
- [ ] (EYES) Tooltips: delay, placement, wording, and density help terminology without
      obstructing normal knob/button use.
- [ ] (EYES/A11Y) Keyboard navigation: header Undo/Redo, workflow strip, compact Project
      controls, preset browser, and expanded Project controls follow a sensible focus
      order with visible focus rings.
- [ ] (EYES) Reduced motion: project expansion, toasts, favorite/autosave pulses, and
      workflow hover states are static or appropriately reduced.
- [ ] (EYES) Visual hierarchy: primary actions read as primary, meters feel quieter, and
      Project management no longer dominates first launch.

## FIX S1 — 2026-07-05 audit findings resolution (headless runtime verification)

Fixed and verified under the Node DOM+WebAudio harness (each bug reproduced failing
BEFORE the fix, then re-run passing after; 17/17 regression suite green):

- [x] **AUDIT #2 — unbounded stem buffers.** Verified: 3 repeat HPSS+Mid/Side runs held
      `WF.Tracks` at exactly 4 derived tracks / constant bytes (pre-fix: 4→8→12).
- [x] **AUDIT #1 — snapshot growth + silent storage failure.** Verified: 25 snapshots →
      1 project entry, flat capped-at-20 history, ~1.3 KB linear growth per snapshot;
      forced quota failure now shows a status message + console.error (pre-fix:
      duplicate project entry per save, "snapshot saved" shown while nothing persisted).
- [x] **AUDIT #3 — NaN BPM injection.** Verified: clearing the seq BPM field in Sync
      keeps `WF.state.bpm`/`wobbleHz()` finite; "abc" input also ignored; valid input
      still applies (pre-fix: both went NaN).
- [x] **AUDIT #4 — outCeiling contradiction.** Resolved as KEEP + correct docs: it is a
      −1 dB clip-safety brickwall that only engages where the merged bus would otherwise
      hard-clip (numerically modeled, same method as FIX 1); FIX 1 and BUGFIX A entries
      annotated. Verified: engine.js header diagram matches the real graph.
- [x] **AUDIT #5/#6 — fake-active visuals + hardcoded correlation + duplicated L/R.**
      Verified: sequencer playback with injected 0.5-amp sine reads RMS −9.0 dB (exact)
      with real spectrum/phase; stereo L=−R playback reads CORR −1.00 measured; mono
      sources read "mono" with a single honest rail; all-stopped renders dim/idle.
- [x] **AUDIT #7 — autosave/undo missing knob/toggle/grid edits.** Verified: a fresh
      session of knob/toggle/wave/octave/grid edits (no text input) now produces an
      autosave entry + available undo (pre-fix: neither, despite real state changes).

**Discovered during S1 (fixed as the root cause of AUDIT #1):** `LS_ACTIVE` was written
with raw `setItem` but read via `JSON.parse` → active-project id always read as "" →
duplicate project entry per save, snapshots never attached to the active project, and
the audit's predicted exponential nesting was latent behind it. Fixed together with #1
(raw-read `activeId()`), since fixing either alone would have made things worse.

New by-ear items from S1:

- [ ] (EARS) **outCeiling GR at performance levels** — play heavy Wobble+Growl on a low
      note at YOUR real levels and watch "GR OUT": it should sit at 0.0. If it moves,
      back `master` off; if it moves at levels you actually want, schedule a listening
      session to retune per-bus ceilings for guaranteed sum headroom (not done blind).
- [ ] (EARS/EYES) **Honest meter bridge in a real browser** — Lanes and Sequencer
      playback must drive real scope/spectrum/meters (no idle animation while audible);
      a stereo file shows measured CORR and independent L/R rails; a mono source shows
      one rail + "mono"; Quick Split preview registers on the meters.
- [ ] (EYES) **Undo/autosave coverage feel** — knob drags now push debounced history;
      confirm undo granularity feels right (one undo step per ~settled edit, not per
      pixel of drag).

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
