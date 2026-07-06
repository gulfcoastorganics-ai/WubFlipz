# wubflipz — UX Changelog

## 2026-07-06 — UX Sprint 3.1

Declutter and reorder pass only. No DSP, synthesis, scheduling, audio routing, or
theme styling changes.

- Reordered the page so vertical scroll now follows the workflow strip:
  Design → Sample → Analyze → Split → Arrange → Save / Share → Advanced.
- Moved the full keyboard immediately after the Design rack to keep auditioning close
  to sound creation.
- Moved Save / Share below Arrange while preserving the existing session controls.
- Consolidated advanced utilities at the bottom: Fuzzer, JSON export, upload,
  snapshots, and layout/workspace controls.
- Kept Copy Share Link in the main Save / Share workflow.
- Kept advanced tools visible and keyboard-accessible; they are de-emphasized but not
  hidden behind a toggle.
- Deferred the idle meter null-state fix because the required real playback/idle repro
  could not run in this container.

## 2026-07-06 — UX Sprint 3

Workflow compression only. No DSP, synthesis, scheduling, or audio routing changes.

- Added Design as a first-class workflow strip stage.
- Made the workflow strip sticky so core progression stays available while scrolling.
- Added compact audition controls using the existing keyboard-note path.
- Made the Status Center actionable with one next-step button per success state.
- Added contextual emphasis for active workflow sections and muted blocked sections.
- Added a Continue Session surface for prior saved work.
- Clarified arrangement copy in Lanes and Sequencer.
- Quieted advanced/non-core controls without removing them: Fuzzer, JSON export, Upload,
  Snapshot, and Layout controls are visually secondary.
- Reduced meter competition when no audio is active.
- Fixed a Sprint 2 status overwrite that could show "Default Sound Loaded" during edits.

## 2026-07-06 — UX Sprint 2

Workflow continuity only. No DSP, synthesis, or audio routing changes.

- Added unified save semantics for Sound/Preset, Session/Project, Layout, Snapshot,
  Share, and JSON export.
- Added a Global Status Center with timestamped workflow feedback for load/save/share,
  autosave, recovery, analysis, split, undo/redo, and failures.
- Added Sound Modified and Session Modified dirty indicators with save/load clearing
  behavior and destructive-action prompts.
- Upgraded the workflow strip to READY/ACTIVE/COMPLETE/BLOCKED states with blocker
  reasons and honest Save / Share wording instead of fake Export.
- Disabled Analyze, Quick Split, and Wobble Match until a sample exists.
- Added next-step guidance after successful preset load/save, sample load, analysis,
  split, and session save.
- Improved continuity from Split to Lanes with stem-count confirmation, Lanes highlight,
  and one-click Open Lanes.
- Improved preset continuity by auto-loading the first factory sound on first launch.
- Improved sequencer continuity with empty guidance, hit count, and Stopped/Playing
  button language.
- Rewrote key technical labels into producer-first language while keeping technical
  names as secondary context where useful.

## 2026-07-06 — UX Sprint 1

Workflow polish only. No DSP, synthesis, or audio routing changes.

- Added a compact first-run workflow strip below the header with automatic current-step
  and completed-step states.
- Collapsed Project management into a compact default panel while preserving all
  existing project, autosave, recovery, snapshot, workspace, metadata, recent-project,
  dock, and sample-management controls in the expanded view.
- Mirrored Undo/Redo into the header using the existing history system, with disabled
  states, keyboard shortcut tooltips, and toast feedback.
- Rewrote empty states for Sample, Analyze, Quick Split, Lanes, and User Presets so they
  explain the next useful action.
- Made autosave state visible and explicit, including saving, saved timestamp, recovery,
  and storage-failure states.
- Added delayed terminology tooltips for Project, Workspace, Snapshot, Preset, Growl,
  HPSS, and Wobble Match.
- Improved hierarchy and polish without redesigning the app: brighter primary actions,
  quieter meters, lower-emphasis project board, focus rings, hover elevation, preset
  load pulse, favorite pulse, autosave check pulse, and undo/redo toast.
- Accessibility quick wins: workflow `aria-current`, aria-live status regions, hidden
  Project details removed from tab order while collapsed, clearer button labels, and
  reduced-motion guards for new animations.
