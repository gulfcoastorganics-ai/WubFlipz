# wubflipz — STATUS LOG

Running log of what's built, what's been validated by ear, and known issues.
Update at every checkpoint.

---

## 2026-07-06 — WORKFLOW COMPRESSION AUDIT

Audit-only pass. No code, markup, CSS, DSP, or app behavior changed.
- Wrote `AUDIT_REPORT_2026-07-06_WORKFLOW_COMPRESSION.md`.
- Overall workflow-compression score: 7.6/10.
- Recommendation: not yet 8.5+/10; close the targeted Sound Save actionability,
  Load Sound placement, Advanced discoverability, and manual scroll-measurement gaps
  before treating workflow compression as complete.
- Chromium runtime remains blocked with exit 133, so rendered scroll distances and live
  click/status behavior are queued for manual browser verification.

---

## 2026-07-06 — UX SPRINT 3.1: declutter and reorder

UX/layout pass only; no DSP, synthesis, scheduling, audio routing, or theme styling
changed.
- Reordered the top-level page flow to match the workflow strip:
  Design → Play/Keyboard → Sample → Analyze → Split → Arrange → Save / Share →
  Advanced.
- Moved the full keyboard directly after the Design rack so sound auditioning stays
  adjacent to sound creation.
- Moved Save / Share below Arrange while preserving the original project/session
  controls and IDs.
- Consolidated advanced tools at the bottom of the page in a visible Advanced zone:
  Fuzzer, Export JSON, Upload, Snapshot, and Layout controls.
- Kept Save, Load, and Copy Share Link in the main Save / Share workflow; only export,
  breeding, snapshot, and layout utilities moved to Advanced.
- Removed the earlier Advanced-zone CSS addition from this pass to preserve the UX
  Freeze requirement: move only, no restyle.

Meter null-state branch:
- Required playback/idle RMS/Peak/Corr/LUFS repro was attempted twice against the
  running dev server on `http://localhost:4173/`.
- Chromium still exits before page execution with the container crashpad/cpufreq error
  (`open /sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq`), so actual playback
  readings could not be collected here.
- Per Sprint 3.1 rules, no meter display patch was made without real playback readings;
  the idle `-3972.2 dB` RMS / `-6466.1 dB` Peak observation remains deferred to S2
  metering validation.

Verified static/headless:
- All `js/*.js` pass `node --check`.
- DOM ID cross-check passes: 182 IDs, no duplicates, no missing `$()` references across
  `ui.js`, `projects.js`, `ux.js`, `presets.js`, and `fuzzer.js`.
- Scroll-order marker check passes in the requested order.
- `git diff --check` passes.
- Browser console and moved-control click behavior still require a real browser pass
  because Chromium runtime is blocked in this container.

---

## 2026-07-06 — UX SPRINT 3: workflow compression

Workflow compression only; no DSP, synthesis, scheduling, or audio routing changed.
- Upgraded the workflow strip to include **Design** as a first-class stage:
  Sound → Play → Design → Sample → Analyze → Split → Arrange → Save / Share.
- Made the workflow strip sticky and state-aware with current-stage glow, completed
  checkmarks, and blocked-state explanations preserved from Sprint 2.
- Added a compact audition strip below the Status Center. It reuses the existing
  keyboard event path (`A S D F`) so a loaded sound can be heard without scrolling to
  the full keyboard.
- Added actionable Status Center behavior: next-step messages now expose a single
  action button such as Play Keys, Analyze, Split Sample, Open Lanes, or Save Session.
- Fixed a Sprint 2 status regression where dirty edits could overwrite the Status
  Center with "Default Sound Loaded."
- Added Design continuity: sound parameter edits mark `Sound Modified`, set Design to
  active, and saved sound design completes the Design stage.
- Improved Arrange clarity through copy:
  - Lanes: "Arrange stems and patterns into a track."
  - Sequencer: "Create rhythm for your arrangement."
- Added contextual emphasis without hiding features:
  - Current workflow panels receive subtle focus.
  - blocked Analyze/Split are muted until a sample exists.
  - meters stay low-emphasis until real audio is active.
  - clean dirty indicators are quiet; modified indicators become prominent.
- Added Continue Session surface when prior saved work exists, with Resume, Open Recent,
  and New Session actions.
- Reduced advanced-feature prominence without removal: Fuzzer is visually marked as
  Advanced, while JSON export, Upload, Snapshot, and Layout controls are secondary.
- Status action targets reduce scrolling: Sample Loaded can run Analyze directly;
  Split Complete can open Lanes; preset load/save points to the audition strip.

Verified headlessly/static:
- All `js/*.js` pass `node --check`.
- DOM id cross-check passes: all `ui.js`/`projects.js`/`ux.js` `$()` references resolve;
  no duplicate ids.
- `git diff --check` passes.
- rAF/timer scan unchanged: `js/vizloop.js` remains the only rAF owner; the only
  `setInterval` match remains the existing sequencer look-ahead scheduler.
- Browser smoke remains blocked by the container Chromium crashpad/cpufreq failure
  documented in prior logs.

---

## 2026-07-06 — UX SPRINT 2: workflow continuity

Workflow continuity only; no DSP, synthesis, scheduling, or audio routing changed.
- Clarified save semantics across the UI:
  - Preset/Sound: saves this sound.
  - Project/Session: saves this session.
  - Layout: saves this workspace view only.
  - Snapshot: creates a restore point.
  - Share: copies current preset.
  - JSON: exports a preset file.
- Added a unified Status Center below the workflow strip. Preset load/save, session
  save/load, autosave, recovery, layout save/load, analysis, split, sample load, share,
  undo/redo, and failures now report through one consistent workflow status surface with
  timestamps.
- Added dirty tracking:
  - Synth/preset parameter edits mark `Sound Modified`.
  - Samples, analysis, split, sequencer, lanes, layout, and metadata edits mark
    `Session Modified`.
  - Saving a preset clears sound dirty; saving a session clears session dirty; loading a
    session clears both.
  - Destructive session/sound load actions prompt when dirty.
- Upgraded the workflow strip from simple progress to state-aware stages: READY, ACTIVE,
  COMPLETE, and BLOCKED with icon/color/tooltip and honest blocker reasons.
- Added feature gating:
  - Analyze is disabled until a sample exists.
  - Quick Split and Wobble Match are disabled until a sample exists.
  - Lanes show a waiting state until tracks/stems exist.
  - Save/Share replaces the misleading Export stage because no render/export engine is
    implemented.
- Added automatic next-step guidance:
  - Default sound loaded → play keyboard.
  - Preset loaded/saved → audition with A S D F or keyboard.
  - Sample loaded → analyze sample.
  - Analysis complete → split sample.
  - Split complete → open/arrange in Lanes.
  - Session saved → continue creating.
- Improved Lanes continuity: split completion reports stem count, highlights Lanes, and
  exposes a one-click Open Lanes action.
- Improved Sequencer continuity: pattern summary now reports 16 steps, hit count, and
  Swing 0%; empty patterns show “Click cells to create your first beat”; Play reports
  Stopped/Playing instead of ambiguous Play/Pause.
- Improved preset continuity: first launch with no active preset loads the first factory
  sound automatically and selects it for immediate audition.
- Microcopy pass: user-facing labels now say Sound, Session, Layout, Tone / Drums Split,
  Center / Side Split, Loudness, and Compression while preserving technical terms where
  useful as secondary text.

Verified headlessly/static:
- All `js/*.js` pass `node --check`.
- DOM id cross-check passes: all `ui.js`/`projects.js`/`ux.js` `$()` references resolve;
  no duplicate ids.
- `git diff --check` passes.
- Browser smoke remains blocked by the same container Chromium crashpad/cpufreq failure
  documented in UX Sprint 1, so live click/visual timing checks remain queued.

---

## 2026-07-06 — UX SPRINT 1: first-60-seconds workflow polish

Workflow polish only; no DSP, synthesis, or audio routing changed.
- Added a compact "Start Here" workflow strip below the header: Load Preset → Play Keys
  → Load Sample → Analyze → Split → Arrange → Export. It highlights the current first
  incomplete step, marks completed steps, and scrolls to the related module on click.
- Converted the Project board to a compact default state with Project Name, autosave
  status, Save, Undo, Redo, and Expand. Expanded state still exposes snapshots,
  workspace/layout, recovery, metadata, recents, panel docking, and sample management.
- Mirrored Undo/Redo into the header using the existing `WF.Project` history functions.
  Buttons share disabled state with the Project controls and show toast feedback such as
  `Undo: Wobble BPM`.
- Improved empty states for Sample, Analyze, Quick Split, Lanes, and User Presets so a
  first-time user sees what action to take next instead of passive empty panels.
- Made autosave status explicit: Autosave ready, Saving..., Autosaved + timestamp,
  Recovery Available, Recovered, Storage Full/failure states.
- Added lightweight delayed tooltips for confusing terms: Project, Workspace, Snapshot,
  Preset, Growl, HPSS, and Wobble Match.
- Adjusted visual hierarchy without redesigning modules: project panel lower emphasis,
  primary actions brighter, meters quieter until hover, consistent focus rings, and
  compact responsive workflow controls.
- Added microinteractions for preset load, favorite pulse, autosave check pulse, undo
  toast, panel expansion, and hover elevation, all guarded by `prefers-reduced-motion`.
- Accessibility quick wins: header undo/redo labels/tooltips, visible focus rings,
  aria-live project/autosave/toast updates, workflow `aria-current`, and collapsed
  Project details removed from the tab order via `inert`.
- Safety/polish cleanup while touching workflows: preset detail/list and project sample/
  dock lists no longer inject user-controlled metadata via `innerHTML`.

Verified headlessly/static:
- All `js/*.js` pass `node --check`.
- DOM id cross-check passes: all `ui.js`/`projects.js`/`ux.js` `$()` references resolve;
  no duplicate ids.
- `git diff --check` passes.
- rAF/timer scan unchanged for visuals: `js/vizloop.js` remains the only rAF owner; the
  only interval match is the existing sequencer look-ahead scheduler.
- Chromium smoke was attempted, but this container still exits 133 in crashpad CPU
  frequency probing before page load. Sandbox networking also cannot `curl` localhost
  even though `ss` shows a listener on `:4173`, so browser runtime UX checks remain
  queued for a real browser.

---

## 2026-07-05 — FIX S1: stability & honesty fixes (from AUDIT_REPORT_2026-07-05)

Six audit findings fixed, each reproduced at runtime BEFORE the fix and re-verified
after, under a Node DOM+WebAudio harness (Chromium still exits 133 in this container).
Full regression suite: 17/17 checks pass, clean boot with zero console errors, all
JS passes `node --check`, DOM-id cross-check passes, rAF ownership still vizloop-only,
site serves 200.

**1. Unbounded stem buffers (audit #2) — stems.js.**
Reproduced: 3 repeat HPSS+Mid/Side runs grew `WF.Tracks` 4→8→12 full-length buffers.
Fix: each split family now replaces its own previous pair (`Tracks.clearDerived(kind)`,
tracks tagged `hpss`/`midside`), cleared only after a successful run so a failed run
keeps old stems. HPSS + Mid/Side still coexist → hard cap of 4 derived tracks.
Re-verified: 3 repeat runs hold at exactly 4 tracks / constant bytes.

**2. Snapshot growth + silent storage failure (audit #1) — projects.js.**
Runtime repro found the audit's mechanism was PARTLY WRONG, and the truth was worse:
`LS_ACTIVE` was written with raw `setItem(id)` but read through `JSON.parse`, which
always threw → active-id always read as "" → every Save/Snapshot minted a NEW project
id and unshifted a duplicate project entry (measured: 1 duplicate entry per save,
unbounded), snapshots never attached to the active project, and the audit's predicted
exponential snapshot nesting was latent (defused by the same bug — it would have
activated the moment the id read was fixed alone). Fixes, together: raw-read
`activeId()` helper (project identity stable); `captureProject()` no longer embeds the
snapshot list at all (kills the recursion at the root — snapshot states are flat);
`saveProject()` preserves the stored entry's snapshots; history capped at 20 with
oldest-eviction (existing cap, now actually exercised); every storage write failure now
surfaces as `console.error` + a `#projectStatus` message instead of vanishing.
Re-verified: 25 snapshots → 1 project entry, 20 flat capped snapshots, ~1.3 KB linear
growth per snapshot, zero nesting; forced quota failure shows
"snapshot save FAILED — storage full?" + console.error (was "snapshot saved" + silence).

**3. NaN BPM injection (audit #3) — sequencer.js.**
Reproduced: clearing the seq BPM field in Sync mode set `WF.state.bpm = NaN` and
`wobbleHz() = NaN` (throws in `setTargetAtTime` on a live graph). Note: the scheduler
itself was partly protected (`stepDur`'s `bpm || 140` catches NaN) — the wobble math
and shared state were the real casualties. Fix: `setBpm` ignores non-finite input and
keeps the last good BPM. Re-verified: clear → 140 retained; "175" → applied; "abc" →
175 retained.

**4. outCeiling vs FIX 1 contradiction (audit #4) — resolved: KEEP + correct the docs.**
Graph truth: `sumBus → master → outCeiling → analyser → destination` — outCeiling IS a
shared DynamicsCompressor on the merged bus, so FIX 1's "no single brickwall on the
merged bus" was false from BUGFIX A onward (FIX 1 entry now carries a correction note).
No live audio here, so the pumping question was answered the same way FIX 1 was: a
numerical model of the actual chain (topLimiter −12/8 + subCeiling −6/6 + outCeiling
−1/20, WebAudio-style fixed makeup gain included, worst-case in-phase peak summation).
Results: outCeiling GR swings at the wobble rate ~1.2 dB near default levels and
~3–4 dB at max crank — BUT in every case where it engages, the summed peak is above
−1 dBFS, i.e. the alternative is hard digital clipping of the merged bus, which no
per-bus stage can prevent and which distorts both buses worse than bounded ducking.
Per-bus ceilings already exist; a post-sum gain element that affects only one bus is
not physically possible. Decision: outCeiling stays as clip safety. Two doc corrections:
(a) FIX 1 annotated; (b) BUGFIX A's "reads 0.0 dB at normal levels" is an overclaim
under worst-case peak alignment — the in-app "GR OUT" meter is the runtime tripwire and
a by-ear check is queued (if GR OUT moves at performance levels, back `master` off; a
listening session may retune per-bus ceilings for guaranteed sum headroom — NOT done
blind here, since it changes every preset's sound). Model caveat: in-phase summation is
pessimistic; real GR will sit between 0 and the modeled values. engine.js's header
diagram now shows outCeiling.

**5. Honest meters (audit #5/#6 + L/R note) — ui.js, fileplayer.js, lanes.js,
sequencer.js, stems.js, index.html.**
Reproduced: sequencer playing → phase scope drawn at full "active" brightness from
synthetic data, RMS stuck at −90 dB, spectrum empty; stereo anti-phase playback →
CORR "+1.00" (truth: −1.00). Fixes: real analyser taps added on every audible context
(lanes master, sequencer limiter, and stereo ChannelSplitter taps on the file player
and lanes); Quick Split preview now routes through the player's meter analyser so it is
measured; `activeFrame()` covers synth → player/preview → lanes → sequencer and visuals
are "active" ONLY when a real measured frame exists (`audioVisualActive()` removed);
correlation is now MEASURED from L/R taps for stereo sources and reads "mono" for
mono-end-to-end sources instead of a fake confident +1.00; phase scope draws a true
goniometer from measured L/R for stereo, keeps the honest mono diagonal otherwise;
header meter shows true independent L/R for stereo sources and collapses to a single
honest rail for mono (right rail hidden, no duplicated fake channel). Idle state keeps
the documented subdued canvas motion, with meters silent and phase dim. Re-verified:
playing sequencer w/ injected 0.5-amp sine → RMS −9.0 dB (exact), phase active with
real data, 48/48 real spectrum bars; stereo L=−R → CORR −1.00, both rails independent;
all-stopped → dim/idle, "mono".

**6. Autosave/undo event gap (audit #7) — ui.js, sequencer.js, projects.js.**
Reproduced: a fresh session of knob arrows/drag, toggle, wave-selector, octave, and
grid-cell edits (state verifiably changed) produced NO autosave and NO undo history;
a text-field control edit did. Fix: those eventless edit paths dispatch a `wf:edit`
CustomEvent; projects.js listens and routes it into the existing debounced
history+autosave (300 ms debounce absorbs drag streams). Re-verified: the same pure
knob/toggle/grid session now yields autosave + undo.

Out of scope, intentionally untouched: other open audit findings (#8 scheduler burst,
#9 innerHTML injection, #10-#21) remain in AUDIT_REPORT/AUDIT_QUEUE. No refactors
beyond the six fixes.

---

## 2026-07-05 — WUBFLIPZ PHASE 4: project/workspace management

Added DAW-style workflow management without changing DSP.
- New Project board with project metadata: name, author, genre, key, BPM, notes.
- Project Browser with saved projects, recent projects, load selected, new project, and
  save project actions.
- Autosave writes a recovery project to LocalStorage after edits and on page unload.
- Crash Recovery button loads the latest autosave when present.
- Undo/Redo history stores full project snapshots in memory with debounced edit capture.
- Session Snapshots save named/restorable project states inside the active project.
- Workspace presets persist layout, panel visibility, and resized panel heights.
- Dockable panels implemented as per-panel show/hide controls; resizable panels use
  native vertical resizing.
- Multiple layouts implemented: Studio, Browser, Performance.
- Sample Management shows a manifest of loaded sample/track/pad references with duration,
  channel count, and sample rate where available. Audio data is not embedded into
  LocalStorage.
- Verified headlessly: `js/projects.js` syntax passes; project DOM IDs resolve; model
  harness covers save/project persistence/recovery/sample manifest; `git diff --check`
  passes.

---

## 2026-07-05 — WUBFLIPZ PHASE 2: upgraded visualization bridge

Upgraded visual feedback without adding duplicate animation loops.
- Added a Drive/Out meter bridge with live Spectrum Analyzer, Phase Scope, RMS Meter,
  Peak Meter, LUFS-M estimate, Correlation Meter, Gain Reduction meters, and Clip
  Indicator/Clear control.
- Existing oscilloscope now shares the same measurement frame as the meter bridge and
  continues to use the unified `WF.Viz` callback. `js/vizloop.js` remains the only file
  with `requestAnimationFrame` / `cancelAnimationFrame`.
- Spectrum uses real analyser frequency bins from the synth final bus, or the sample
  player analyser when sample playback is the active measured source.
- Phase/correlation are honest for the current measured source. The synth output bus is
  mono at this point, so phase draws a stable diagonal and correlation reports +1.00
  rather than inventing stereo width.
- LUFS-M is labeled as a momentary estimate derived from measured mean square; it is not
  a full integrated EBU R128/K-weighted loudness implementation.
- Idle visuals use subdued canvas motion when no measured audio is active; no fake meter
  numbers are displayed.
- Smooth interpolation added for RMS/peak/LUFS/correlation/GR values; visual updates are
  still driven only by `WF.Viz`.
- Verified headlessly: `js/engine.js` and `js/ui.js` syntax pass; all DOM IDs resolve;
  rAF ownership remains single-loop; `git diff --check` passes.

---

## 2026-07-05 — WUBFLIPZ PHASE 1: professional preset browser

Transformed the existing preset workflow without redesigning the app shell.
- Presets panel now includes searchable browser, category/source/tag filters, All/Favorites/
  Recent tabs, sorting by Name/Date/Author/Popularity, keyboard navigation, and a metadata
  detail panel.
- Categories supported: Bass, Growl, Wobble, Lead, FX, Pad, Drum.
- Factory presets now expose metadata: description, BPM, key, character, genre, author,
  popularity, category, and multiple tags.
- User presets are saved as a LocalStorage library instead of only one slot; the legacy
  single-preset key is still read/written for backward compatibility.
- Favorites and recently-used ordering persist in LocalStorage.
- JSON upload/download and share-link compatibility are preserved by normalizing older
  preset JSON into the richer metadata model at load time.
- Verified headlessly: `js/presets.js` and `js/ui.js` syntax pass; preset browser DOM IDs
  exist; search/source/favorite/recent/user-save model checks pass; `git diff --check`
  passes.

---

## 2026-07-05 — POLISH P1: consolidated viz loop + honest live feedback

Interaction/visual polish only; no new audio feature was added.
- Added `js/vizloop.js` as the single `requestAnimationFrame` owner. Sample waveform,
  lanes playhead, sequencer step pulse, scope, meters, FPS, and voice readouts register
  callbacks with `WF.Viz.register(name, fn)`.
- `WF.Viz` computes real FPS from a rolling ~30-frame delta average and parks when the
  page is hidden or `prefers-reduced-motion: reduce` is active. Reduced motion gets a
  static one-shot visual update instead of continuous animation.
- Removed independent rAF loops from `ui.js`, `fileplayer.js`, and `lanes.js`.
- Sequencer scheduler now publishes scheduled `{step,time}` events; the visual loop reads
  due events and toggles `.playing`. No DOM writes happen inside `scheduleStep()`.
- Scope renders the real synth analyser when synth voices are active and the file-player
  analyser when the sample player is active. When all known playback paths are idle, it
  renders a dim 1-2px random-walk noise floor. Because sequencer/lanes/stem preview live
  in separate existing contexts with no permitted extra analysers, scope does not invent
  fake waveform data for those paths.
- Added one permitted post-`outCeiling` meter analyser on the synth final bus. Header peak
  meter/hold ticks and clip latch are measured from that analyser. This does not include
  the separate Sample/Lanes/Sequencer contexts, preserving the existing audio graph.
- Keyboard keys now get `.active` from engine note hooks and clear on release/emergency
  stop; this covers mouse, computer keyboard, and fuzzer audition note paths.
- Analysis readouts now expose tempo autocorrelation peak prominence as confidence %
  and key-profile correlation `r`, including runner-up key. Low confidence tints the
  readout rather than hiding it.
- CSS-only microinteractions added: button press/hover, panel hover, knob hover ring,
  sequencer amber step pulse, keyboard press glow, preset-name load pulse. Knob tick
  marks were skipped because the current SVG construction would require reworking every
  knob render path.
- Verified statically/headlessly: all JS passes `node --check`; only `js/vizloop.js`
  references rAF/cancel rAF; DOM-id cross-check passes; sequencer visual step ordering
  advances 0-15 from published scheduler events; `WF.Viz` parks under hidden/reduced
  motion test harnesses; `git diff --check` passes. Chromium smoke was attempted but
  this container's Chromium exits with code 133 in crashpad CPU-frequency probing before
  returning a page.

---

## 2026-07-05 — FEATURE C: Shareable preset URLs

Extended the existing `WF.Presets` system with shareable patch links.
- Presets still flow through the same `capture()` / `apply()` path as localStorage,
  JSON upload/download, factory presets, Wobble Match output, and Fuzzer saves.
- Share links use `#patch=<encoded>` and include the full preset JSON, including the
  sequencer pattern/pad state.
- Page load checks the hash and auto-loads a valid patch; malformed/corrupt patch hashes
  are caught with a console warning and fall back safely without crashing.
- Added **Copy Share Link** beside preset download/upload controls.
- v1 encoding is dependency-free URL-safe base64 of JSON, not compressed LZ-style data.
  Tradeoff: implementation is small and reliable, but URLs are longer/uglier than a
  compressed patch format would be.
- Headless validation covers byte-identical encode/decode recovery and malformed-hash
  safe failure.

---

## 2026-07-05 — FEATURE B: Sound Fuzzer / preset breeding

New module `js/fuzzer.js` plus a **Fuzzer** board.
- Uses the current active preset as the parent, including factory presets and matched
  wobble estimates loaded by Feature A.
- Generates six synth-only variants at a time, with favorite marking and a Breed action
  that crosses over two or more favorites, then applies a light mutation pass.
- Audition temporarily applies a variant, triggers one held low test note through the
  live synth engine, then restores the previous preset.
- Save promotes any variant through the existing preset system as a normal local preset.
- Mutation bounds are centralized in `WF.Fuzzer.BOUNDS`: cutoff mutates logarithmically,
  wobble divisions snap to adjacent quantized divisions, waveform flips are low
  probability, and modulation/drive/master ranges stay inside usable limits.
- Sequencer pattern mutation is intentionally deferred for v1; variants preserve the
  parent sequencer state unchanged.
- Headless validation covers syntax, DOM IDs, and 1000 mutation iterations with explicit
  bounds assertions. Musical usefulness remains AUDIT_QUEUE.

---

## 2026-07-05 — FEATURE A: Wobble Match from reference track

New module `js/wobblematch.js` plus a **Match Wobble from Track** button in Quick Split.
- Reuses the currently loaded `WF.Player.buffer`; no second upload prompt.
- Browser path runs a bass-band OfflineAudioContext filter pass (~40-250 Hz), then uses
  cheap RMS-window envelope extraction.
- Envelope autocorrelation estimates the dominant modulation rate, then snaps that rate
  to the existing Wobble divisions instead of free-Hz values.
- Depth is estimated from envelope dynamic range; LFO shape uses a simple
  near-extremes-vs-transition duty heuristic (`square` / `sine` / `triangle`).
- Output is loaded through `WF.Presets.apply()` as a normal editable preset named
  "Matched Wobble Estimate"; no detected value is locked or authoritative.
- UI readout explicitly labels the result as an estimated starting point.
- Synthetic validation only: known square-LFO amplitude modulation recovers the expected
  quantized division in headless tests. Real-track usefulness remains AUDIT_QUEUE.

---

## 2026-07-04 — FEATURE: factory preset pack

Added 9 factory presets to `js/presets.js` and exposed them through the existing Presets
module UI via a Factory dropdown + Load Factory button.
- Styles covered: Riddim Grind, Tearout Screech, Melodic Half-Time, Classic Brostep,
  Deep Sub Roller, Chaos Growl, Future Riddim Clean, Swamp Stomp, Neuro Snap.
- Each preset uses the full synth parameter surface and includes a sequencer payload with
  non-silent 8x16 pattern data plus per-pad level/pitch references.
- Factory loading goes through `WF.Presets.apply()`, the same path as local/uploaded
  preset JSON.
- Musical usefulness is not self-certified headlessly; it is tracked in `AUDIT_QUEUE.md`.

---

## 2026-07-04 — FEATURE: step sequencer / drum pad

New module `js/sequencer.js` (`WF.Sequencer`) plus a "Sequencer" board.
- **8-pad default synthesized kit**: Kick, Snare, Clap, Closed Hat, Open Hat, Low Tom,
  Rim, Crash. Each uses cheap oscillator/noise/filter/envelope voices; no files required.
- **Per-pad sample override**: each pad can decode an uploaded sample via the sequencer's
  AudioContext, with per-pad level and pitch/playback-rate nudge. Presets store the sample
  reference name/settings, not embedded audio data.
- **Fixed v1 grid**: 16 steps × 8 pad rows, binary on/off cells, Play/Pause/Stop,
  seeded with a minimal kick/snare/closed-hat pattern so playback makes sound immediately.
  Deferred intentionally: 8/32-step variants, swing/humanize, and per-step
  velocity/accent.
- **Clock**: Sync/Independent toggle. Sync mode reads/writes the same `WF.state.bpm`
  used by Wobble; Stage 5 tempo auto-fill flows through the existing Wobble BPM input,
  so the sequencer follows it. Independent mode keeps its own BPM.
- **Scheduling**: look-ahead scheduler (`setInterval` poll every 25ms, schedule events
  inside a 100ms Web Audio window using `AudioContext.currentTime`) rather than
  setTimeout-per-step.
- **Routing**: sequencer has its own AudioContext, drum master gain, and drum limiter.
  It never enters the wobble-modulated synth filter or a shared synth compressor path.
- **Stop-All from day one**: `stopall.js` calls `WF.Sequencer.emergencyStop()`, which
  cancels the scheduler interval, ramps drum master gain down over ~10ms, calls `.stop(0)`
  on active/scheduled pad sources, clears voice registry, and resets playhead/transport UI.
- **Presets**: preset JSON now includes sequencer sync/BPM, full 8×16 pattern grid, and
  per-pad level/pitch/sample reference.
- **Verified headlessly/static**: scheduler math exposed via `testSchedule`; Stop-All
  wiring includes Sequencer explicitly; full browser smoke test pending below in this run.
  Kit quality, live sync feel, and bus interaction need real listening → AUDIT_QUEUE.

---

## 2026-07-04 — BUGFIX: global stop leak + Emergency Stop

Confirmed root cause before fixing: Quick Split preview was its own playback path
(`stems.js` created a `BufferSource` connected directly to `ctx.destination`) with no
visible Stop control and no exported kill method, so Sample Stop and Lanes Stop could
not silence it. This was separate from the synth voice graph and the lane scheduler.

Fixes:
- Added always-visible red **Emergency Stop** in the header (`js/stopall.js`) that calls
  hard-stop hooks for Synth, Sample, Lanes, and Quick Split preview.
- Each hard-stop hook ramps its output gain to 0 over ~10ms, then calls `.stop(0)` on
  active sources/voices and resets UI playback state.
- Added a Quick Split **Stop Preview** button and routed preview audio through a
  dedicated gain node so it can be ramp-muted before the hard stop.
- Tightened regular Sample/Lanes Stop cleanup: clear source refs, cancel rAF loops, and
  stop Quick Split preview when section-level Stop is pressed.
- Emergency Stop also broadcasts `wf:emergency-stop` so the keyboard UI clears held-note
  highlights owned by `ui.js` after synth voices are killed.
- Added a real-browser listening item to `AUDIT_QUEUE.md`; headless checks can verify
  wiring, not audible silence.

---

## 2026-07-04 — STAGE 5: tempo / key / beat-grid detection + snap

New module `js/analyze.js` (`WF.Analyze` + `WF.Grid`) and an "Analyze" board.
- **Tempo**: spectral-flux onset envelope → autocorrelation over 70–180 BPM (mild bias
  against octave errors) → comb-correlation for beat phase. Auto-populates the **existing,
  editable** Wobble BPM field (never silently authoritative — it writes into the input the
  user can change).
- **Key**: whole-track chroma → Krumhansl-Schmuckler major/minor profile correlation.
  Shown in an editable dropdown; no auto-transpose. Confidence (correlation r) displayed.
- **Beat grid**: `WF.Grid` draws beat lines on the Sample waveform (per-frame hook) and on
  the Lanes (full-axis overlay). Loop-region edges and click-seek **snap** to the nearest
  beat when Snap is on. Grid/Snap toggles.
- **Verified headlessly**: synthetic 140-BPM click train → detected **140.00 BPM**;
  synthetic C-major chord → detected **C major** (r=0.63); full 10-module init clean.
  Real-music BPM/key accuracy + grid alignment + snap feel → AUDIT_QUEUE (EARS/EYES).

---

## 2026-07-04 — STAGE 4: per-stem DAW lanes

New module `js/lanes.js` (`WF.Lanes`) + a "Lanes" board. Consumes `WF.Tracks` (original
+ Quick Split derivations) and renders one lane each.
- **Per lane**: peak waveform (shared 0..maxDuration time axis so all lanes align under
  one playhead), volume fader, pan (StereoPanner), Mute, Solo.
- **Shared transport**: single Play/Stop; on play, every lane's BufferSource is scheduled
  against **one** `WF.Player.ctx` clock at a common `startTime + offset` — no per-lane
  timers, so lanes stay sample-accurate. One overlay playhead; click a lane to seek; the
  Sample loop region applies to all lanes.
- **Isolation**: reuses the file player's AudioContext; independent of the synth voices.
- **Deferred (as allowed)**: vertical lane drag-reorder — skipped to protect the shared
  timeline; not required this pass.
- **Verified headlessly**: builds exactly 3 lanes for 3 tracks; Solo lane[1] →
  gains [0, 0.85, 0]; Mute lane[0] → [0, 0.85, 0.85] (solo/mute/vol math correct).
  Sample-accurate sync + real playback → AUDIT_QUEUE (EARS).

---

## 2026-07-04 — STAGE 3: Quick Split (DSP stem separation, no ML)

New modules: `js/fft.js` (dependency-free radix-2 FFT) and `js/stems.js` (`WF.Stems`,
`WF.Tracks` registry), plus a "Quick Split" board. Labeled honestly in the UI as
approximate DSP, **not** professional stem quality.
- **HPSS** (Fitzgerald 2010): manual STFT (fftSize 2048, hop 512, Hann) → magnitude
  spectrogram → horizontal (time) median = harmonic, vertical (freq) median = percussive,
  soft Wiener ratio masks → ISTFT overlap-add. Two-pass, magnitudes-only storage +
  per-frame complex recompute to bound memory; processed in time-chunks with `await`
  yields + progress so the UI doesn't freeze.
- **Mid/Side**: (L−R)/2 vocal-remove, (L+R)/2 vocal-isolate (stereo only; mono files get
  a clear message). Cheap, no FFT.
- Up to 4 derived tracks land in `WF.Tracks` (consumed by Stage 4 lanes); Stage 3 has a
  small ▶ preview per track.
- **Verified headlessly**: FFT correct (peak bin + round-trip err ~1e-14); HPSS
  reconstruction `H+P ≈ input` (err ~7e-8); steady tone → 100% harmonic, transients →
  100% percussive. Real-music separation quality → AUDIT_QUEUE (EARS). Long-file memory
  → AUDIT_QUEUE (STRESS): chunked, but not yet run on a real 5-min track.

---

## 2026-07-04 — STAGE 2: file upload, waveform, transport

New modules: `js/waveform.js` (reusable peak summaries + draw) and `js/fileplayer.js`
(`WF.Player`), plus a full-width "Sample" board in index.html.
- **Upload**: drag-drop zone + file picker (`audio/*`).
- **Decode off main thread**: `file.arrayBuffer()` (async) → `decodeAudioData` (browser
  background thread) → peak summary computed in **chunked** `setTimeout` slices
  (4000 blocks/tick) with a progress bar. No size assumptions; long files don't block.
- **Waveform**: peak-based min/max per pixel column from a mono block summary (~≤200k
  blocks regardless of length), not sample-by-sample.
- **Transport**: play/pause/stop, click-to-seek, drag-to-select loop region (with loop
  on/off + clear), zoom in/out around the playhead. Playhead animates via rAF.
- **Isolation**: `WF.Player` uses its **own** AudioContext + BufferSource; it never
  touches the synth voice graph. Exposes `onLoaded` hooks for Stages 3–5.
- **Verified headlessly**: all 5 scripts init with no errors; `summarize()` peak math
  correct on a synthetic 1M-sample stereo buffer (−0.75/+0.75), blockSize floor (64)
  holds on tiny buffers, `drawPeaks` runs. Playback/seek/loop timing → AUDIT_QUEUE (EARS/EYES).

---

## 2026-07-04 — BUGFIX A + B (before Stages 2–5)

**BUGFIX A — residual sub movement / output-stage compressor.**
- Traced `sumBus → master → analyser → destination`: after Fix 1 there is **no shared
  DynamicsCompressor downstream of sumBus** (the original shared limiter was already
  removed). So the hypothesized "same bug one level downstream" does not exist in the
  graph — nothing there was riding the wobble.
- Still added a final **safety brickwall** (`outCeiling`: thr −1 dB, ratio 20, atk 1 ms,
  rel 50 ms) after `master`, per the spec's intent: pure clip protection that reads
  **0.0 dB** at normal levels and only engages on genuine overs — never an active
  dynamics stage on the merged bus. Also resolves the "no brickwall on merged bus"
  clip-risk I flagged in Fix 1. Meter now shows "Comp GR top/sub/out". → AUDIT_QUEUE (EARS).
  **[NOTE 2026-07-05, FIX S1: "reads 0.0 dB at normal levels" is an overclaim under
  worst-case in-phase peak alignment — modeling shows it can engage ~1 dB near defaults
  and ~3–4 dB at max crank, always only where the sum would otherwise hard-clip. Kept
  as clip safety; watch "GR OUT" by ear. Details in the FIX S1 entry.]**

**BUGFIX B — on-screen keyboard not rendering.** Root cause was NOT keyboard-specific:
a **temporal-dead-zone crash**. `bindOctave("octave", …, () => relabelKeys())` (ui.js)
ran its `upd()` at init, which called `relabelKeys()`, which reads `keyEls`/`BASE` —
both declared with `const` later in the file. Accessing a `const` before its declaration
throws `ReferenceError: Cannot access 'keyEls' before initialization`, aborting the whole
UI IIFE, so `buildKeyboard()` (and toggles/BPM/presets/power/canvases after it) never ran.
- Fix: `bindOctave` now updates only the value display at init (`setDisp()`), deferring
  the `extra` side-effect to button clicks / `refreshAll`. `buildKeyboard()` labels keys
  itself. Root cause, not a symptom patch.
- **Verified headlessly** (node DOM+WebAudio shim, no browser): init throws nothing;
  `#keys` builds 25 elements (15 white + 10 black); simulated `A` keydown → voiceCount
  0→1. Actual sound still → AUDIT_QUEUE (EARS).

---

## 2026-07-04 — FIX 1: sub-bass wobbles under heavy Wobble/Growl — ⚠️ NEEDS EARS AGAIN

**Diagnosed cause (traced/modeled before changing anything):**
- **#1 Growl pitch-drift leak → NOT the cause (clean).** Code trace: `gPitch` connects
  only to `oscA.detune` + `oscB.detune` (engine.js:193). The sub oscillator has zero
  modulation connections of any kind. Ruled out; not touched.
- **#2 Shared dynamics stage → CONFIRMED, this was the bug.** The sub bus summed into
  the *same* `preBus` as the wobble-filtered top layer, feeding one shared waveshaper +
  one shared `DynamicsCompressor` before output. The top layer's wobble-rate level
  swings drove that shared compressor's gain reduction, ducking the clean sub in sync.
  Modeled with the engine's real comp settings (thr −12 / ratio 8 / atk 3 ms / rel
  200 ms): sub level swung **1.4 dB @ 1/16, 2.4 dB @ 1/8, 3.7 dB @ 1/4 & half-time** —
  clearly audible, worse at slower wobble (release tracks the longer period).
- Could not run real-time audio `.reduction` logging here (headless, no browser/audio),
  so confirmation is by graph trace + a numerical model of the compressor. A live
  `.reduction` readout ("Comp GR top / sub" in Drive/Out) was added so the by-ear
  re-check also empirically confirms it.

**Fix applied (de-couple sub from the shared dynamics stage):**
- Top layer and sub now hit **separate** compressors and merge *after* compression:
  `filter → preBus → shaper → topLimiter → sumBus` and `subBus → subCeiling → sumBus`,
  then `sumBus → master → analyser → out`. Because the sub's ceiling only ever sees the
  steady sub, its gain reduction is DC → modeled post-fix swing **0.00 dB** at every rate.
- Chose the hybrid of options (a)+(b): sub joins post-compression AND gets its own gentle
  ceiling (`subCeiling`: thr −6, ratio 6, atk 5 ms, rel 150 ms) since it now skips the
  shared limiter.

**Tradeoffs to confirm by ear (flagged per spec):**
- The sub now also **bypasses the shared waveshaper**, so it is fully DRY — no saturation
  on the sub anymore (previously it was saturated; that was the earlier flagged decision).
  This is more consistent with "clean & steady," but if you want sub harmonics for small-
  speaker audibility we'd add a *dedicated, steady* sub saturator (safe — steady in =
  steady harmonics, no wobble). Not done yet.
- There is now **no single brickwall on the merged bus** (intentional — a shared final
  limiter would re-introduce the exact pumping). Each path is limited individually and
  summed pre-master. At defaults the summed peak is well under 0 dBFS, but if you crank
  `subLevel` + `master` together, watch for clipping and back `master` off.
  **[CORRECTED 2026-07-05, FIX S1: this stopped being true one entry later — BUGFIX A
  added `outCeiling` (thr −1 dB, ratio 20) as a clip-safety brickwall on the merged
  bus, so a shared dynamics stage DOES exist there again. See the FIX S1 entry for the
  measured pumping analysis and why it stays.]**

**Status: NOT self-certified. Needs a listening test** — play a heavy Wobble+Growl
preset on a low note and confirm the sub sits rock-steady under the wobble while watching
"Comp GR top / sub" (top should swing, sub should stay ~constant).

---

## 2026-07-04 — CHECKPOINT 1 (Stage 0 + Stage 1) — ⚠️ NEEDS EARS

Stage 1 engine is wired and boots clean, but **no audio has been validated by ear
yet.** This is the NEEDS-EYES / NEEDS-EARS gate defined in the build spec. Do not
begin Stage 2 until a human confirms the sound. I am explicitly *not* self-certifying
audio quality.

### Built
- **Stage 0 scaffold**: `index.html`, `js/engine.js`, `js/ui.js`, `js/presets.js`,
  `css/style.css`, `STATUS_LOG.md`, `README.md`.
- **Core voice** (ported from prior synth build): two oscillators A+B
  (sine/tri/saw/square), Detune (±1200 ct), equal-power Mix, ±3 Octave.
- **Filter**: 24 dB low-pass, Cutoff (log 30 Hz–18 kHz), Resonance/Q.
- **ADSR** amplitude envelope with live-redrawing shape graph.
- **Output**: Master → tanh waveshaper → `DynamicsCompressor` limiter → phosphor
  oscilloscope. Readouts: polyphony (n / cap), sample rate, base latency.
- **AudioContext**: `latencyHint:'interactive'`, lazy-started on first gesture.
- **Wobble module**: tempo-synced LFO → filter cutoff (via `filter.detune`, so the
  sweep is exponential/musical). BPM field (default 140), half-time toggle,
  quantized musical divisions (1/1…1/16 + dotted + triplet — no free-Hz), Depth
  knob, LFO waveform (sine/tri/square). Live rate readout in Hz.
- **Growl module**: second faster LFO. A single "Amount" knob blends simultaneous
  modulation of cutoff (adds to wobble), resonance (Q), and a small ±22 ct pitch
  drift on both main oscillators. Independent Rate knob (2–60 Hz), LFO waveform.
- **Sub-bass voice**: always-on pure sine, independent octave (default −1), routed
  to its own bus that **bypasses the wobble/growl-modulated filter** — the top layer
  cannot make the sub wobble. This is the intended fix for the thin/muddy diagnosis.
- **Waveshaper/saturation**: tanh curve, Drive knob (0 = effectively clean → grit).
  `oversample:'4x'` to reduce aliasing.
- **Presets**: full-state JSON. Save/Load to `localStorage`, Download `.json`,
  Upload from file. UI refreshes to match a loaded preset.
- **Voice discipline**: `MAX_VOICES = 16` with oldest-voice stealing; explicit
  `disconnect()` of every node on envelope release (incl. removing the growl pitch
  bus's connection to each voice's osc detune) to prevent node-graph leaks.

### Validated
- Static: all three JS files pass `node --check`; every DOM id referenced by
  `ui.js` exists in `index.html`; site serves 200 on `python3 -m http.server 4173`.
- **By ear: NONE. Pending.** No headless browser + no speakers in the build env.

### Needs a listening test (please confirm)
1. Wobble feels musical and locks to BPM across divisions; half-time = classic slow.
2. Growl adds gnarl without going harsh/unstable at high Amount + high Q.
3. **Sub stays steady and audible under heavy wobble** (the core mix fix).
4. Drive adds weight/grit without turning to mush; 0 is clean.
5. No clicks on note on/off; no runaway/stuck voices over a long jam.
6. No console errors on load or first note.

### Decisions to confirm at the gate (I made a call — flag if wrong)
- **Sub goes THROUGH the waveshaper** (it joins the pre-output bus, which is pre-
  saturation). Rationale: harmonic saturation makes a sub audible on small speakers.
  It still bypasses the *wobble/growl filter*, so the spec's "don't let the sub
  wobble" is honored. If you want the sub 100% dry, we route it post-shaper instead.
- Wobble modulates `filter.detune` (cents), not `filter.frequency` (Hz), so sweeps
  are exponential/musical rather than linear. Standard for wobble bass, but noting it.
- Growl Rate is free-Hz (2–60), not tempo-synced — the spec called for "independent
  rate control" and growl is a fast/formant layer. Say the word to quantize it too.

### Known issues / limitations
- Changing octave (Z/X) while a *computer* key is physically held can leave that one
  note stuck until window blur (which clears all notes). Carried over from the prior
  synth; low priority. Fixable by tracking held notes by key char rather than midi.
- No external audio file loading yet — that is Stage 2, intentionally not started.

### Next (Stage 2 — DO NOT START until the above is heard and signed off)
- (per spec) external audio buffer loading and whatever else Stage 2 defines.
