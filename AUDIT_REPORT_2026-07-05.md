# wubflipz — Independent Audit Report

**Date:** 2026-07-05
**Scope:** index.html, js/* (15 files), css/style.css, cross-referenced against STATUS_LOG.md and AUDIT_QUEUE.md.
**Method:** read every file in full; traced actual node connections rather than trusting comments; verified STATUS_LOG claims by grep (rAF ownership, AudioContext creation sites, every OscillatorNode/AudioBufferSourceNode creation vs. the stop dispatcher). All 15 JS files pass `node --check`. This is a static audit — no browser/audio runtime was available, consistent with the environment limits STATUS_LOG itself documents.

---

## 1. Executive summary

The codebase is in genuinely good shape for its size and honest about most of its limitations, and the two headline STATUS_LOG audio claims **hold up under adversarial tracing**: the sub bus really does bypass the shared waveshaper and the top-layer compressor (`subBus → subCeiling → sumBus`, engine.js:143-144), and every audio-producing path — synth voices, file player, lanes, Quick Split preview, sequencer, fuzzer audition (which rides the synth engine) — is reachable from the Emergency Stop dispatcher. However, the audit found real defects the logs don't know about: **session snapshots embed all prior snapshots recursively, so serialized size grows exponentially and will silently exhaust localStorage after ~15–20 snapshots** (projects.js); **repeated Quick Split runs accumulate full-length decoded buffers with no cap** (`Tracks.clearDerived()` exists but is never called), which is the most credible path to hitting the 2.7 GB ceiling; and **clearing the sequencer BPM field in Sync mode writes NaN into shared `WF.state.bpm`**, wedging wobble-rate math and the scheduler until a valid BPM is retyped. On the honesty front, most readouts are real, but the meter bridge quietly lies during Lanes/Sequencer playback (animated "idle" spectrum and an actively-styled fake phase trace while audio is audible), and the correlation meter is hardcoded toward +1.00 rather than measured — misleading for stereo sample playback. STATUS_LOG also contains one internal contradiction (FIX 1 says "no single brickwall on the merged bus"; BUGFIX A then added one — `outCeiling` is a shared DynamicsCompressor on the merged bus, which reintroduces a bounded, documented, but real pumping risk at hot levels) and overclaims autosave/undo coverage, since knob drags, toggles, and grid clicks never emit the `input`/`change` events the history listener depends on.

---

## 2. Findings table

Severity: Critical / High / Medium / Low / Note.

| # | Severity | Area | Description | Evidence | Suggested fix |
|---|----------|------|-------------|----------|---------------|
| 1 | **High** | Persistence / memory | **Exponential snapshot nesting.** `captureProject()` includes `snapshots: currentProjectSnapshots()`, and `saveSnapshot()` stores `state: captureProject(...)`. So snapshot N embeds snapshots 1…N−1, each of which embeds its own predecessors — serialized size roughly doubles per snapshot. Capped at 20 snapshots, but 2^20× base size blows past the ~5 MB localStorage quota long before that; `write()` catches the QuotaExceededError and returns false, which every caller ignores, so project saves/autosaves start **silently failing**. Undo stack (40 in-memory copies) and the beforeunload autosave amplify the same payload. | projects.js:119-133 (captureProject), :168-178 (saveSnapshot), :28-31 (silent write) | Exclude `snapshots` from the state captured inside a snapshot (`captureProject` should not embed the snapshot list, or `saveSnapshot` should strip it). Surface `write()` failure in `#projectStatus`. |
| 2 | **High** | Memory (2.7 GB ceiling) | **Unbounded derived-track accumulation.** Every click of HPSS or Mid/Side calls `Tracks.add(...)` without clearing previous derivations — `clearDerived()` is defined but **never called anywhere** (verified by grep). Each HPSS run adds 2 full-length Float32 buffers (~53 MB each for a 5-min mono track) plus lane summaries; each run also transiently peaks ~400–500 MB during processing. Three or four repeat clicks on a long track plausibly OOMs the 2.7 GB environment. Lanes also rebuild with duplicate rows each time. | stems.js:17 (defined), :117-118 & :123-124 (add without clear); grep: no caller of `clearDerived` | Call `Tracks.clearDerived()` (or remove same-kind tracks) at the start of `runHPSS`/`runMidSide`, or disable the buttons after a successful run until the file changes. |
| 3 | **Medium** | Audio correctness | **NaN injection into shared BPM.** `Sequencer.setBpm` does `v = clamp(parseFloat(v), 40, 300)` with no `isFinite` guard. Clearing the `#seqBpm` field while Sync is on writes `WF.state.bpm = NaN`, then sets `#bpm` to "NaN" and dispatches `input`; ui.js's own guard (`if (!isFinite(v)) return`) prevents recovery via that dispatch. Result: `wobbleHz()` returns NaN (next `onParam("bpm")` calls `setTargetAtTime(NaN)`, which throws), and `stepDur` → `nextTime += NaN` silently halts the scheduler loop. Recoverable only by typing a valid BPM into the synth field. | sequencer.js:171-179 (setBpm), :133-139 (advance/tick); ui.js:161-164 (guard that blocks recovery) | Guard `setBpm` with `if (!isFinite(v)) return;` before clamping. |
| 4 | **Medium** | Audio correctness / shared-bus pumping | **`outCeiling` is a shared DynamicsCompressor on the merged bus** (`sumBus → master → outCeiling → analyser → destination`). At normal levels (thr −1 dB, ratio 20) it reads 0 dB GR, as BUGFIX A claims. But if `subLevel` + `master` + hot presets push the merged peak over −1 dBFS, top-layer wobble peaks will duck the sub through it — exactly the failure mode FIX 1 removed, in bounded form. STATUS_LOG FIX 1 ("There is now **no single brickwall on the merged bus**") directly contradicts the current graph. Also note WebAudio DynamicsCompressorNodes apply fixed makeup gain, so "reads 0.0 dB" describes reduction, not unity gain. | engine.js:107-116; STATUS_LOG.md:376-380 vs :324-327 | Keep the ceiling (reasonable tradeoff) but amend STATUS_LOG FIX 1 with a pointer to BUGFIX A; the GR OUT meter already exists to watch it. Optionally clamp `master`×`subLevel` headroom. |
| 5 | **Medium** | UI honesty | **Meter bridge misrepresents Lanes/Sequencer playback.** `activeFrame()` only measures the synth and the sample player. When only Lanes or the Sequencer are audible: the spectrum draws the *animated idle pattern* (`0.04 + 0.025·sin(t)`), the phase scope draws a fake sine wiggle **at full "active" brightness** (`active` flag is true via `audioVisualActive()`), and RMS/PEAK/LUFS decay toward −∞ while audio plays. STATUS_LOG claims "Phase/correlation are honest for the current measured source" and "no fake meter numbers" — the scope disclaimer exists, but the animated spectrum/phase during live playback is fake motion presented as live. | ui.js:470-486 (activeFrame), :544 (fake spectrum), :554-560 (phase drawn "active" with synthetic data), :450-455 | When `audioVisualActive()` is true but no analyser covers the source, freeze/dim the spectrum & phase and label them "unmetered source", instead of animating. |
| 6 | **Medium** | UI honesty | **Correlation meter is not measured.** `smooth.corr += (1 - smooth.corr) * 0.18` — it asymptotically renders +1.00 regardless of signal. Defensible for the mono synth bus (and STATUS_LOG says so), but it also displays +1.00 while playing a **stereo** file through the player (AnalyserNode downmixes; correlation is simply never computed). The header L/R peak rails likewise duplicate one mono value (`getOutputPeak` returns `left: peak, right: peak`). | ui.js:498; engine.js:338-344; index.html:30-31 | Either compute real correlation from a ChannelSplitter on the player path, or label the meter "mono bus" / hide it for stereo sample playback. Collapse the L/R rails to one labeled MONO rail. |
| 7 | **Medium** | Docs vs code | **Autosave/undo miss most sound-design edits.** History capture hooks `document`-level `input`/`change` events (projects.js:315-316), but knobs (pointer drag/wheel/arrow keys), wave selectors, toggles, octave buttons, and sequencer grid cells are buttons/divs that emit **no** `input`/`change` events. STATUS_LOG Phase 4 claims "Autosave writes a recovery project after edits" and "debounced edit capture" — in practice only typed fields and range sliders trigger it; a pure knob-tweaking session is only saved at page unload. | projects.js:315-316; ui.js:73-93 (knob events), :151 (toggle click); sequencer.js:188 (cell click) | Emit a `wf:edit` CustomEvent from Knob.set / bindToggle / grid clicks and listen for it in projects.js, or call `WF.Project`'s scheduler from those paths. |
| 8 | **Medium** | Audio correctness / scheduler | **Look-ahead scheduler bursts after main-thread stalls and in background tabs.** `while (S.nextTime < now + 0.10)` with a 25 ms tick never drops or double-schedules (each step's `nextTime` advances exactly once — the specific failure modes asked about are absent), but after a stall > 100 ms all missed steps are scheduled **in the past** and fire simultaneously as a machine-gun burst. Background tabs throttle `setInterval` to ~1 Hz, so a hidden playing sequencer degenerates into once-per-second bursts of ~9 steps at 140 BPM. | sequencer.js:9 (TICK_MS 25 / LOOKAHEAD 0.10), :137-140 | On tick, if `S.nextTime < now`, jump it forward to the next step boundary (skip, don't cram); optionally enlarge look-ahead or move the timer to a Worker. |
| 9 | **Medium** | Security / robustness | **HTML injection via preset metadata and file names.** `renderPresetBrowser`/`selectPreset` build rows and the detail panel with template-literal `innerHTML` from `p.name`, `description`, `author`, `genre`, `tags` — all attacker-controlled in an uploaded preset .json (persisted to the library, so it re-executes every session) and in project sample manifests (`renderSamples` injects uploaded file names). Client-only app, so impact is self/stored-XSS via traded preset files, but preset sharing is an advertised feature. | ui.js:249-251, :263; projects.js:255 | Build these nodes with `textContent`, or escape interpolated fields. |
| 10 | **Low** | Voice management | **The 16-voice cap counts held voices only.** `noteOff` deletes the voice from the map immediately while its release tail (up to 3 s) still sounds, so actual sounding oscillators can exceed 16×3 = 48 under rapid retriggering with long release. Disposal itself is correct — `oscA.onended → disposeVoice` disconnects everything including the `gPitch` fan-out, and Emergency Stop force-stops and disposes — so there are **no zombie oscillators**, just a soft cap. | engine.js:238-252, :182-189, :232 | Acceptable as-is; if headroom becomes a problem, count releasing voices against the cap or shorten steal-release. |
| 11 | **Low** | Memory / leak | **Unbounded arrays while sequencer plays.** `S._scheduledLog` grows forever during playback (cleared only on `play()`), and `S._stepEvents` is drained only by the viz loop — which is **parked** when the tab is hidden or reduced-motion is on, so both grow ~9 entries/sec indefinitely during background playback. | sequencer.js:129-130, :229; vizloop.js:23-35 | Cap `_scheduledLog` (it's a debug artifact) and drain/trim `_stepEvents` inside `scheduleStep` when older than a few seconds. |
| 12 | **Low** | UX correctness | **Reduced-motion/hidden-tab parks functional logic, not just cosmetics.** Lanes end-of-track auto-stop lives in the viz callback (`tickVisual`), so with `prefers-reduced-motion` or a hidden tab, lane sources end naturally but `L.playing` stays true and the transport shows "Pause". Same class of issue as #11. | lanes.js:80-84; vizloop.js:12-13 | Use `source.onended` for transport-state cleanup instead of the visual tick. |
| 13 | **Low** | UX correctness | **Rapid Fuzzer auditions restore the wrong preset.** Each `audition()` captures "pre-audition" state; auditioning variant B within 950 ms of A captures A as the restore target, so the session ends with A applied instead of the original. Second audition is also silent (noteOn(36) no-ops while 36 is held). | fuzzer.js:132-139 | Keep one module-level `restore` captured on the first audition of a burst; clear it when the last timer fires. Use a different audition note or force retrigger. |
| 14 | **Low** | Dead code / docs | `WF.Presets.loadFactory` has no caller; the "Factory dropdown + Load Factory button" from the 2026-07-04 factory-pack entry no longer exists in index.html (superseded by the Phase 1 browser — factory presets are still reachable via the Source filter, so no functionality lost). Also `Grid.snap` has leftover unused `lo/hi` binary-search vars. | presets.js:322-328; grep: no UI caller; analyze.js:130 | Remove `loadFactory` or note supersession in STATUS_LOG. |
| 15 | **Low** | UI honesty | **Pad sample names restored without sample data.** `Sequencer.apply` restores `sampleName` from a preset but not the audio (by design — references only), so a pad can display "kick.wav" while actually playing the synth fallback, or a *stale previously-uploaded* sample under the new name. | sequencer.js:257, :204 | Suffix "(not loaded)" when `sampleName` is set but `sample` is null; clear `pad.sample` on apply. |
| 16 | **Low** | Accessibility | Small text at 9–10 px in `--faint` (#6b6252 on #141009 ≈ 3.1:1) fails WCAG AA for header stats, meter labels, step heads, fuzz metadata. Waveform/lane seek and loop-drag are pointer-only with no keyboard alternative. Otherwise good: knobs are focusable sliders with arrow keys, ARIA labels/pressed states are widespread, seq cells are labeled buttons, and default focus rings are not suppressed (only `.knob`/`.preset-list` opt out and both provide replacements). | style.css:5, :28, :136, :212; fileplayer.js:180-194 | Bump `--faint` to ~#7d745f+ for small text; add keyboard seek (arrow keys on a focusable wave container). |
| 17 | **Low** | Stop coverage edge | Loading a **new file** doesn't stop a running Quick Split preview of the old file's stems (`loadFile` calls only the player's own `emergencyStop`); the orphaned preview plays to completion unless Stop/Emergency Stop is pressed. | fileplayer.js:35; stems.js (stopPreview not hooked to onLoaded) | Call `WF.Stems.stopPreview()` in `loadFile` or in the `onLoaded` reset. |
| 18 | **Note** | Latent bug | `P.gain.value = 1` sets a useless expando on the GainNode (should be `P.gain.gain.value`). Harmless today because the default is 1. | fileplayer.js:26 | Fix spelling. |
| 19 | **Note** | Docs drift (in-file) | engine.js's header diagram omits `outCeiling` ("sumBus -> master -> analyser -> out"); actual chain inserts outCeiling between master and analyser. | engine.js:8 vs :112-116 | Update comment. |
| 20 | **Note** | Mix behavior | The sequencer's single drum limiter (thr −6, ratio 8) is shared by all 8 pads — a hot kick will pump the hats *within* the drum bus. Isolated from the synth (own AudioContext), so the STATUS_LOG isolation claim holds; this is intra-kit only. | sequencer.js:39-42 | By-ear call; note in AUDIT_QUEUE's kit-quality item. |
| 21 | **Note** | Edge case | Typing in `#detBpm` fires `setBpm` per keystroke — a partial "1" sets synth BPM input to 1 (state clamps to 40 but the field shows 1) and rebuilds the grid at 1 BPM. Also `estimateTempo`'s search stops at 180 BPM, so 174 DnB detects fine but >180 halves. | analyze.js:167-174, :46 | Apply on change/blur, or debounce. |

---

## 3. Signal graph (as actually connected in code)

Three independent AudioContexts (verified: exactly three `new AudioContext` sites) plus per-use OfflineAudioContexts (wobblematch; render-only, no audible output, no stop path needed).

```
CONTEXT 1 — SYNTH (engine.js, lazy on first gesture)
 per voice (≤16 held):
   oscA ─ gA ─┐
   oscB ─ gB ─┴─ vca(ADSR) ──► N.filter (lowpass, modulated) ─► preBus ─► shaper(tanh,4x) ─► topLimiter ──┐
   subOsc ─ subVCA(ADSR) ────────────────────────────────────────────────► subBus ─► subCeiling ─────────┤
                                                                                              (merge) sumBus
                                                                                                        │
                                                                            master ◄────────────────────┘
                                                                              │
                                                                          outCeiling  ◄── SHARED comp on merged bus
                                                                              │           (thr −1dB, ratio 20 — safety;
                                                                    ┌─────────┴───────────┐  see finding #4)
                                                                 analyser            meterAnalyser (dead-end, metering only)
                                                                    │
                                                              ctx.destination
 modulators: wobbleLFO ─ wobbleDepth ─► filter.detune (cents)
             growlLFO ─ growlAmt ─┬─ gCut ─► filter.detune
                                  ├─ gQ ──► filter.Q
                                  └─ gPitch ─► (per-voice) oscA.detune, oscB.detune
 ✔ CONFIRMED: sub path touches neither N.shaper nor N.topLimiter. It DOES pass through outCeiling.

CONTEXT 2 — FILE PLAYER (fileplayer.js), shared by Lanes and Quick Split preview
   Player:  BufferSource ─► P.gain ─► P.analyser ─► destination
   Lanes:   per lane BufferSource ─► gainNode ─► StereoPanner ─► L.master ─► destination
            (single shared start time t0 = now+0.06 → sample-accurate claim structurally sound)
   Preview: BufferSource ─► previewGain ─► destination

CONTEXT 3 — SEQUENCER (sequencer.js)
   per hit: osc/noise(BufferSource) [─ filter] ─► envGain ─► S.master ─► S.limiter ─► destination

EMERGENCY STOP (stopall.js) — dispatch verified against every source-creation site:
   Engine.emergencyStop ✔ (voices; fuzzer audition rides this)
   Player.emergencyStop ✔   Lanes.emergencyStop ✔   Stems.emergencyStop ✔ (preview)
   Sequencer.emergencyStop ✔ (interval + tracked voice set)
   wobblematch OfflineAudioContext: render-only, inaudible — no stop needed ✔
   → No orphaned audible path found. (Edge: finding #17, preview vs. new-file load.)
```

---

## 4. Scorecard

*(Individual dimensions only, per instructions — no composite number.)*

- **Audio Correctness: 7/10.** The core isolation architecture (three contexts, sub decoupling, per-path limiting, complete stop coverage, leak-free voice disposal) survives adversarial tracing; docked for the shared `outCeiling` residual pumping risk contradicting FIX 1's text, the NaN BPM hole, and background-tab scheduler bursts.
- **Architecture: 7/10.** Modules own clear responsibilities behind `WF.*` with everything namespaced (no loose globals found), but cross-module coupling via `dispatchEvent(new Event("input"))` as an API (sequencer→ui, analyze→ui) and direct `WF.state.bpm` writes from the sequencer make shared-tempo ownership fuzzy — which is exactly where the NaN bug lives.
- **Code Quality: 7/10.** Consistent idiom, defensive try/catch around browser APIs, good fallbacks (StereoPanner, clipboard, cancelAndHoldAtTime, localStorage); docked for missing input guards, `innerHTML` with user data, dead code, and no-op lines like `P.gain.value = 1`.
- **UI/UX Honesty: 6/10.** FPS, voices, GR meters, BPM/key confidence, and detection readouts are genuinely wired to real values, and reduced-motion is respected globally via the single parked viz loop; docked because the phase scope and spectrum animate fake "active" data during Lanes/Sequencer playback, correlation is hardcoded, and the L/R rails duplicate a mono value.
- **Documentation Accuracy: 7/10.** Unusually candid logs whose major claims (rAF ownership, stop wiring, sub routing, honest-labeling of estimates) verified true; docked for the FIX 1 ↔ BUGFIX A merged-bus contradiction, the stale factory-dropdown entry, the autosave/undo overclaim, and "phase/correlation are honest" being partly false.

**Overall impression (prose):** a well-built, self-aware hobby-DAW whose audio core is trustworthy at normal levels; the real risks now live in persistence (snapshot explosion), memory accumulation (repeat splits), and a handful of honesty gaps in the meter bridge — all cheap to fix relative to what's already here.

---

## 5. Top 5 fixes, ranked by risk ÷ effort

1. **Stop snapshot recursion** (finding #1) — one-line change (`snapshots: []` inside snapshot state capture) prevents silent, compounding data loss. Highest risk, lowest effort.
2. **Call `Tracks.clearDerived()` before each split** (finding #2) — one line; removes the most credible OOM path in the 2.7 GB environment.
3. **`isFinite` guard in `Sequencer.setBpm`** (finding #3) — one line; prevents wedging shared tempo/wobble/scheduler from an empty input field.
4. **Honest meter fallback for unmetered sources** (findings #5/#6) — small ui.js change: dim + "unmetered" label when Lanes/Sequencer are the only audible source; stop hardcoding correlation. Restores the app's own stated honesty standard.
5. **Escape user-controlled strings in preset browser / sample manifest** (finding #9) — switch to `textContent`; closes the stored-XSS vector before share links/preset trading spread further.

### AUDIT_QUEUE cross-check
- The checked-off Emergency Stop item ([x]) is **consistent with code** — dispatcher coverage re-verified here, including the sequencer path.
- All still-open items remain genuinely open; none were found secretly resolved. Two items should be **added**: the localStorage snapshot failure mode (#1) and repeat-split memory growth (#2) — the existing (STRESS) memory item only covers a single HPSS run, which is the safe case.
