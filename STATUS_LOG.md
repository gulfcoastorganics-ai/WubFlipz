# wubflipz — STATUS LOG

Running log of what's built, what's been validated by ear, and known issues.
Update at every checkpoint.

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
