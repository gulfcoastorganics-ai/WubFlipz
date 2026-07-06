# wubflipz — Workflow Compression Audit

**Date:** 2026-07-06
**Scope:** Post-Sprint-3 + Sprint-3.1 UX workflow compression only. No DSP, visual design, or code-quality scoring.
**Inputs read:** `STATUS_LOG.md`, `AUDIT_QUEUE.md`, `UX_CHANGELOG.md`, Sprint 3 commit `f2c1c7b`, Sprint 3.1 commit `9ed7ae9`, current `index.html`, `js/ux.js`, `js/ui.js`, `js/fileplayer.js`, `js/stems.js`, and `js/projects.js`.
**Runtime limitation:** Chromium was re-tested for this audit and still exits `133` before page execution with crashpad/cpufreq errors. Rendered pixel scroll distances, console cleanliness, click timing, and live status behavior therefore require manual browser verification. This report does not fake those readings.

---

## Executive Summary

Sprint 3 and 3.1 did more than reorganize the page: they added real workflow compression in three places:

- A default/loaded sound can be auditioned from the top audition strip without scrolling to the full keyboard.
- Successful sample load and analysis events wire into a single Status Center action, reducing manual hunting for Analyze and Split.
- Sprint 3.1 fixed the most obvious vertical mismatch by moving Fuzzer out from between Sample and Analyze and placing Save / Share after Arrange.

The work is not yet an 8.5+/10 compression pass. The remaining gaps are specific:

- The Sound Save path is not as compressed as the Session Save path. Sound edits set status text but do not expose a one-click "Save Sound" action.
- "Load Sound" remains embedded at the bottom of the Design rack rather than existing as a top-level section. The workflow strip solves this if used, but the vertical page itself still begins with Oscillators, not preset choice.
- Advanced tools are visible at the bottom, but because no restyle was allowed, the new Advanced grouping depends on raw existing markup. Discoverability needs a real browser/a11y pass.
- Reduced scrolling is plausible from static wiring, but not proven. The exact scroll cost depends on rendered panel heights, sticky behavior, viewport size, and smooth-scroll target placement.

**Recommendation:** Not ready to shift directly to the stepper sprint as "compression complete." Close the small workflow gaps first, especially Sound Save actionability and manual verification of scroll reduction. Overall workflow-compression score: **7.6/10**.

---

## Per-Path Cost Table

Costs below are static minimums from current DOM and event wiring. Pixel scroll distances require manual browser verification.

| Path | Static minimum interactions | Scroll distance | Context switches | Evidence | Audit read |
|---|---:|---|---:|---|---|
| 1. Load preset -> hear it | **Default/factory loaded:** 1 click on audition key or 1 physical keypress. **Manual preset choose:** select/load preset + audition = usually 2 clicks after browser is visible. | Intended 0 for audition because `auditionStrip` is directly below Status Center. Preset browser visibility depends on viewport because it is inside the Design rack near the bottom. | 0-1 | `auditionStrip` is top-level before the rack; buttons dispatch keyboard events. Preset load emits "Ready to Play" targeting `auditionStrip`. | Strong improvement. The fastest path is genuinely short, but preset selection itself may still require scroll unless workflow strip/status takes the user there. |
| 2. Load sample -> Analyze -> Split -> stems in Lanes | **Drag/drop path:** drop file, Status Analyze, Status Split scroll, click split type, Status/Open Lanes = about 4 interactions. **Browse path:** Browse + OS file choose + same flow = about 5 app/OS interactions. | Manual scroll can be 0 if Status Center actions are used; app performs `click()` on Analyze and `scrollIntoView()` to Split/Lanes. Pixel distance unverified. | 1-2 | Sample load emits next-step target `detectBtn`; analysis emits target `quickSplitBoard`; split emits target `lanesBoard`. | Good compression. One gap: after analysis, the action scrolls to Quick Split but cannot choose HPSS vs Mid/Side, so the user still must decide and click a split type. That is acceptable but not one-click-to-stems. |
| 3. Design a sound -> Save | Parameter edits + sound save = at least 2 interactions, but likely includes scroll/mouse travel from Wobble/Growl/Filter to the Sounds module. | Requires manual measurement. Sounds is inside the Design rack after Drive/Out, so it may be below the active design controls. | 1 | `wf:edit` sets "Sound Modified" status text, but does not call `suggest()` and therefore does not set a `Save Sound` Status Center action. `presetSave` is still only in the Sounds module. | Weakest core compression path. Design state is tracked, but saving the designed sound is not made actionable from the Status Center. |
| 4. Return session -> resume prior work | 1 click if Continue Session appears and `recentProjects` has a value. Fallback is Resume -> Recover Autosave. | 0 if `continueSession` is visible after launch. | 0 | `showContinueSession()` reveals the continue surface when projects exist; `resumeSession` dispatches recent change or clicks Recover Autosave. | Strong static design. Needs manual validation that localStorage ordering and hidden/expanded Project state produce the expected resume target. |
| 5. Reach advanced tools from core loop | From Save / Share: scroll to immediately following Advanced zone, then click target tool. Advanced tools themselves are 1 click after visible, except Upload/Workspace prompts. | Requires manual measurement. Advanced is below Save / Share, not in workflow strip. | 1 | Advanced zone follows `projectBoard`; Fuzzer, Export JSON, Upload, Snapshot, Layout are there. Copy Share Link correctly stays in Save / Share. | Acceptable but borderline. Consolidation reduced core clutter, but there is no workflow affordance pointing to Advanced. That is probably correct for UX Freeze, but discoverability must be checked manually. |

---

## Per-Criterion Scores

### Scrolling reduced: **7/10**

Evidence:

- Audition strip eliminates the need to scroll to the full keyboard for first sound.
- Status Center actions can click Analyze directly and scroll to Split/Lanes.
- Sprint 3.1 removed the previous Fuzzer interruption between Sample and Analyze.

Limits:

- Pixel scroll distance cannot be measured without a running browser.
- Sound Save still likely requires movement from design controls to the Sounds module.
- Advanced tools require scrolling below Save / Share.

### Context switching reduced: **7.5/10**

Evidence:

- Status Center becomes a single source for next action.
- Sample -> Analyze -> Split -> Lanes now has explicit event-driven next steps.
- Continue Session gives return users a direct starting point.

Limits:

- Designing a sound still splits attention between active module, Status Center, and Sounds save controls.
- Advanced tools are consolidated but detached from the main workflow, which is correct for de-emphasis but still a context switch.

### Audition loop shortened: **8.5/10**

Evidence:

- `auditionStrip` is directly under Status Center and dispatches the same keyboard note path.
- Preset load/default load points users to "Press A S D F."
- Full keyboard was moved immediately after Design, so deeper audition remains closer than before.

Limits:

- Manual browser verification is required for audio gesture/browser autoplay behavior and perceived latency.
- If the user wants to browse presets rather than use the default, the preset browser position inside the rack may still require scroll.

### Status Center actionability: **7/10**

Evidence:

- Sample Loaded -> Analyze.
- Analysis Complete -> Split Sample / Quick Split.
- Split Complete -> Open Lanes.
- Preset Loaded/Saved -> Play Keys.
- Session Saved -> Continue creating.

Limits:

- Sound Modified only sets status text; it does not expose a `Save Sound` action.
- Analysis Complete targets the Quick Split board rather than a concrete split action, so one more decision/click is required.
- Some local statuses still exist (`presetMsg`, `projectStatus`, `splitStatus`), so Status Center is primary but not literally the only feedback surface.

### Workflow strip reduces hesitation: **8/10**

Evidence:

- Stages have READY / COMPLETE / BLOCKED state logic.
- Blocked Analyze/Split explain "Load sample first."
- Current stage uses `aria-current`, marker changes, and titles/tooltips.
- Workflow order now includes Design and Save / Share honestly.

Limits:

- Save can read as complete if an active project exists and the session is clean, even if the user has not intentionally saved in the current session.
- "Load Sound" is a workflow stage but not a top-level page section; the target is inside the Design rack.

### Advanced controls still discoverable after consolidation: **6.5/10**

Evidence:

- Advanced zone is visible, not hidden behind a toggle.
- Tools remain keyboard-reachable by DOM order.
- Copy Share Link correctly stays in Save / Share.

Limits:

- Advanced is not represented in the workflow strip.
- No new styling was allowed, so the Advanced zone may read as a quiet raw grouping rather than a deliberate utility area.
- Fuzzer is nested inside Advanced, so it is discoverable only after reaching the bottom.

### Page order supports workflow: **8.5/10**

Evidence:

- Static marker order is now: Design rack -> Sample -> Analyze -> Split -> Sequencer -> Pads -> Lanes -> Save / Share -> Advanced.
- Fuzzer no longer interrupts Sample -> Analyze.
- Save / Share follows Arrange.
- Copy Share Link remains with Save / Share, not buried in Advanced.

Limits:

- The full keyboard sits between Design and Sample. It is not a top-level workflow section, but it means literal vertical order is Design -> Keyboard -> Sample.
- Load Sound is inside the Design rack rather than a top-level first section.

---

## Overall Workflow-Compression Score

**7.6/10**

This is a meaningful improvement over a tool collection. It is not yet a fully compressed production flow. The app now gives the user a path, but not every important path is equally compressed. The sample path is strong; the audition path is strong; the design-save path is still under-compressed.

---

## Findings

### 1. Sound Save is not actionable from the Status Center

**Problem:** Sound edits show "Sound Modified" / "Save sound when ready," but no Status Center action button appears for `presetSave`.

**Impact:** The producer can design a sound and then must remember where the preset save control lives.

**Evidence:** `wf:edit` calls `setStatus(...)`, not `suggest(...)`; `actionLabel()` has no `presetSave` case.

**Severity:** Medium.
**Suggested fix:** Add one next action after sound edits: `Save Sound` -> `presetSave`. This is workflow-only and low architectural cost.

### 2. Load Sound is not vertically first despite being workflow stage 1

**Problem:** The workflow strip begins with Load Sound, but the page begins with Oscillators/Sub/Filter/Wobble. The preset browser exists at the bottom of the Design rack.

**Impact:** Users relying on vertical scanning rather than the strip may hit synthesis controls before finding the sound browser.

**Evidence:** `presetBrowser` is inside the rack after Drive / Out; the top-level page order was intentionally changed to Design first.

**Severity:** Medium.
**Suggested fix:** Do not redesign yet. First manually verify whether the workflow strip/status reliably gets first-time users to the preset browser. If not, consider making the existing Sounds module the first module inside the Design rack in a later targeted pass.

### 3. Sample -> Analyze is compressed; Analysis -> Split is only half-compressed

**Problem:** After analysis, the Status Center action takes the user to Quick Split but does not run a split, because HPSS vs Mid/Side is a real choice.

**Impact:** This is honest but still creates a small hesitation.

**Evidence:** `analyze.js` emits target `quickSplitBoard`, while split buttons remain separate.

**Severity:** Low/Medium.
**Suggested fix:** Keep the choice. Improve copy only if manual users hesitate: "Choose Tone/Drums or Center/Side."

### 4. Advanced consolidation reduced clutter but may reduce discoverability too far

**Problem:** Advanced tools are now below Save / Share with no workflow-strip entry and no runtime affordance pointing there.

**Impact:** Core loop is cleaner, but Fuzzer/Snapshot/Layout may feel missing to returning users.

**Evidence:** Advanced zone follows Save / Share; no workflow button targets `advancedZone`.

**Severity:** Medium.
**Suggested fix:** Manual a11y/browser pass first. If users miss it, add a non-interruptive "Advanced below" microcopy near Save / Share, not a new workflow.

### 5. Scroll-reduction claim is not fully verifiable headlessly

**Problem:** Static DOM order is correct, but actual scroll burden depends on viewport, sticky header/strip height, and rendered panel heights.

**Impact:** Sprint may have improved logical order without reducing physical movement as much as claimed.

**Evidence:** Chromium exits `133`; no layout engine measurement available.

**Severity:** Medium.
**Suggested fix:** Manual scroll-distance pass using the steps below.

### 6. Meter null-state remains a visible honesty gap

**Problem:** User-observed idle RMS/Peak values are physically meaningless and remain unpatched because playback repro is blocked in-container.

**Impact:** If visible in normal idle after Stop, this undercuts the "honest feedback" standard during common use.

**Evidence:** STATUS_LOG and AUDIT_QUEUE track idle `-3972.2 dB` RMS / `-6466.1 dB` Peak as S2 repro-gated.

**Severity:** Separate S2 item, not scored into workflow compression.
**Suggested fix:** Real browser playback/idle read first, then patch display null-state only if playback values are sane.

---

## Manual Browser Verification Required

Run these in a real browser tab at `http://localhost:4173/`. Record click count, approximate scroll distance in viewport-heights, and any hesitation.

### A. Load preset -> hear it

1. Hard-refresh WubFlipz.
2. Without scrolling, click an audition-strip key (`A`, `S`, `D`, or `F`).
3. Load a different preset from the preset browser.
4. Click/press an audition key again.
5. Record whether the first sound happened within one interaction and whether preset selection required scrolling.

### B. Load sample -> Analyze -> Split -> stems in Lanes

1. Load a sample by drag/drop or Browse Sample.
2. Use only the Status Center action when it appears.
3. Run Analyze.
4. Use the next Status Center action after analysis.
5. Choose Tone / Drums Split.
6. Use the Open Lanes action after split.
7. Record clicks, automatic scrolls, manual scrolls, and whether stems appear in Lanes without confusion.

### C. Design sound -> Save

1. Audition a sound.
2. Change Wobble Depth, Growl Amount, or Filter Cutoff.
3. Observe workflow strip and Status Center.
4. Save the sound.
5. Record how many clicks/scrolls were needed after the edit and whether "where do I save this sound?" occurred.

### D. Return session -> resume prior work

1. Save a session.
2. Reload the page.
3. Click Continue Last Session -> Resume.
4. Confirm the correct project loads.
5. Repeat with no recent project selected, if possible, to verify Recover Autosave fallback.

### E. Reach each advanced tool

1. Start from Save / Share.
2. Reach Export JSON, Upload, Snapshot, Layout Save/Load, Dock visibility, Fuzzer Generate, and Fuzzer Breed.
3. Confirm each remains visible, keyboard-reachable, and fires its original handler.
4. Record whether Advanced feels discoverable or buried.

### F. Known meter honesty gap

1. Load a preset and play a voice.
2. Record RMS / Peak / Corr / LUFS.
3. Stop all audio.
4. Record RMS / Peak / Corr / LUFS at idle.
5. If playback values are sane and idle values are garbage, classify as display null-state bug. If playback is also garbage, classify as S2 DSP-metering bug.

---

## Recommendation

Do **not** treat Sprint 3.1 as 8.5+/10 complete yet. It is close enough to avoid another broad UX sprint, but it needs a small targeted compression cleanup before moving to the stepper sprint:

1. Add Status Center `Save Sound` action after sound-design edits.
2. Manually verify whether Load Sound being inside the Design rack causes first-use hesitation.
3. Manually verify Advanced discoverability from Save / Share.
4. Complete the meter null-state repro in a real browser so the honesty gap stops carrying forward.

If those pass or are fixed, WubFlipz can move to the stepper sprint without carrying major workflow-compression debt.
