# wubflipz — UX Changelog

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
