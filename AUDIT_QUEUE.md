# wubflipz — AUDIT QUEUE

Items that need **human by-ear / by-eye verification**. Autonomous build logs them
here instead of pausing. Nothing here is self-certified. Check the box once a human
has verified it in a real browser with real audio.

Legend: `[ ]` unverified · `[x]` verified by human · `(EARS)` needs listening ·
`(EYES)` needs visual check · `(STRESS)` needs a real large/long file.

---

## Phase 1 Build Pass — Item 1: WebGL meter rendering

- [ ] (EYES) Confirm in a real browser with real audio: silence shows flat/zero
      meters (no fake motion); a full-scale test signal reads full-scale; a
      phase-inverted stereo test file shows a visibly inverted Lissajous pattern on
      the phase scope; mono material reads correlation as "mono" not a fake +1.00,
      and out-of-phase stereo material reads correlation near -1. Automated headless
      verification (Playwright + synthetic WAV tones) already passed — see
      STATUS_LOG.md 2026-07-06 entry — this is the required human sign-off, not a
      re-check of functionality.

## UX Sprint 3.2 — compression gap-closer

- [ ] (EYES) Save Sound action: after changing Wobble Depth, Growl Amount, or Filter
      Cutoff, confirm the Status Center exposes a "Save Sound" action and that it fires
      the existing preset save path.
- [ ] (EYES/A11Y) Advanced affordance copy: confirm the Save / Share text line is
      visible, understandable, and does not feel like a new workflow or panel.
- [ ] (EYES) Quick Split copy: confirm the prompt "Choose Tone / Drums or Center /
      Sides." reduces hesitation without implying automation that does not exist.

## Workflow Compression Audit — 2026-07-06

- [ ] (EYES) Validate measured scroll cost for Sound → Play → Design → Sample →
      Analyze → Split → Arrange → Save in a real browser; static DOM order is correct,
      but pixel/viewport scroll reduction could not be measured headlessly.
- [ ] (EYES) Sound-design save compression: after editing Wobble/Growl/Filter/Drive,
      confirm whether users can find Save Sound without hesitation. Audit finding:
      Status Center currently says "Sound Modified" but does not expose a one-click
      Save Sound action.
- [ ] (EYES) Load Sound placement: confirm first-time users find the preset browser
      quickly even though it is inside the Design rack rather than a top-level first
      section.
- [ ] (EYES/A11Y) Advanced discoverability: from Save / Share, confirm users can find
      Export JSON, Upload, Snapshot, Layout, and Fuzzer without a workflow-strip entry.
- [ ] (EYES) Analysis-to-Split handoff: after Analysis Complete, confirm the Status
      Center scroll to Quick Split plus the required HPSS/Mid-Side choice feels clear,
      not like a dead end.

## UX Sprint 3.1 — declutter and reorder

- [ ] (EYES) Page order: vertical scroll now matches the workflow strip without making
      the app feel newly redesigned: Design → Sample → Analyze → Split → Arrange →
      Save / Share → Advanced.
- [ ] (EYES/A11Y) Advanced zone: Fuzzer, Export JSON, Upload, Snapshot, and Layout
      remain visible, keyboard-reachable, and discoverable at the bottom without
      competing with the main workflow.
- [ ] (EYES/A11Y) Save / Share: Save, Load, and Copy Share Link remain in the main
      Save / Share workflow and do not feel stranded in Advanced.
- [ ] (EYES) Moved advanced controls still fire their original handlers in a real
      browser: JSON export, JSON upload, snapshot creation, layout save/load, dock
      visibility, fuzzer generate, and fuzzer breed.
- [ ] (EYES) Keyboard placement after Design reduces scroll/travel without confusing
      the relationship between the audition strip and full keyboard.
- [ ] (EYES) Browser console pass: confirm no runtime errors after DOM reordering.
- [ ] (EYES/DSP-METER S2) Meter null-state requires real playback repro. User-observed
      idle values were RMS `-3972.2 dB` and Peak `-6466.1 dB`; Chromium runtime is
      blocked in this container, so playback/idle RMS/Peak/Corr/LUFS readings still
      need collection before deciding display-null fix vs. DSP-meter bug.

## UX Sprint 3 — workflow compression

- [ ] (EYES) Workflow strip 2.0: Sound → Play → Design → Sample → Analyze → Split →
      Arrange → Save / Share reads naturally, and Design becomes active/complete at the
      right moments.
- [ ] (EARS/EYES) Audition strip: pressing A/S/D/F buttons triggers sound reliably in a
      real browser and reduces the need to scroll to the full keyboard.
- [ ] (EYES) Actionable Status Center: each next-action button does exactly one useful
      thing and never surprises the user.
- [ ] (EYES) Contextual emphasis: current workflow sections are subtly emphasized,
      blocked sections are muted, meters activate with real audio, and no feature feels
      hidden.
- [ ] (EYES) Continue Session: prior work is surfaced on first launch, Resume/Open Recent/
      New Session behave predictably, and users trust their work is safe.
- [ ] (EYES) Arrange clarity: Lanes and Sequencer copy makes arrangement feel like the
      place songs come together, not a disconnected preview area.
- [ ] (EYES) Advanced emphasis: Fuzzer, JSON, Upload, Snapshot, and Layout are still
      available but no longer compete with the core production loop.
- [ ] (EYES) Scroll reduction: complete Sound → Play → Design → Sample → Analyze → Split
      → Arrange → Save and compare scroll/click burden against Sprint 2.

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
