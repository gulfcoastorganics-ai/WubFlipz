# wubflipz

A standalone dubstep **wobble-bass synth and browser sample workstation** built with plain HTML/CSS/JavaScript, Web Audio and Canvas. It has no production build step, framework, hosted backend, or required account.

## Run

Serve the repository as a static site so browser storage, workers, and file workflows run in a normal HTTP origin:

```bash
python3 -m http.server 4173
```

Then open `http://127.0.0.1:4173/`. Audio starts after the first user interaction because of browser autoplay policy.

## Play

- **Computer keyboard:** `A W S E D F T G Y H U J K …`; `Z` / `X` shift octave.
- **Mouse / touch:** click keys or drag across them.
- **Knobs:** drag vertically, hold **Shift** for fine adjustment, use the wheel, double-click to reset, or use keyboard arrows while focused.
- **Web MIDI:** supported browsers can connect external MIDI controllers and map CC messages through MIDI Learn.

## Synth modules

| Module | What it does |
|---|---|
| **Oscillators** | Two oscillators, waveform selection, detune, equal-power mix, ±3 octave range |
| **Sub Bass** | Dedicated sine sub path that bypasses the wobble filter |
| **Filter** | 24 dB low-pass cutoff/resonance stage |
| **Wobble** | Tempo-synced LFO into filter cutoff with musical divisions, depth and waveform selection |
| **Growl** | Faster modulation layer affecting cutoff, resonance and slight pitch drift |
| **Envelope** | ADSR amplitude shaping with live graph |
| **Drive / Out** | Saturation, master level, limiter, scope and real signal metering |
| **Presets** | Save/load browser presets plus JSON download/upload |

## Sample workstation

The lower workflow extends the synth into a client-side sample environment:

- **Sample** — local audio import, decode, waveform, transport, seek, loop selection and zoom.
- **Analyze** — editable BPM/key estimates, beat grid and snap assistance.
- **Quick Split** — DSP-only HPSS harmonic/percussive and Mid/Side separation. HPSS processing runs in a Web Worker and uses transferable buffers where supported.
- **Lanes** — synchronized tracks with waveform, volume, pan, mute and solo.
- **Projects / restore points** — IndexedDB-backed project state and capped independent snapshots.
- **MIDI** — note input and MIDI Learn mappings routed through the same control paths as the on-screen interface.

Audio quality is deliberately not self-certified. `STATUS_LOG.md` contains the implementation/validation ledger and `AUDIT_QUEUE.md` tracks remaining human by-ear/by-eye checks.

## Architecture

```text
per voice:  oscA \
            oscB  > mix -> VCA(ADSR) -> modFilter ---------\
            subOsc -> subVCA(ADSR) -> subBus --------------> preBus -> shaper -> master -> limiter -> scope -> out

wobbleLFO -> depth ----------------> modFilter.detune
growlLFO  -> amount -> cutoff -----> modFilter.detune
                    -> reso -------> modFilter.Q
                    -> pitch ------> per-voice oscillator detune
```

Core implementation lives under `js/`. Voices are capped at 16 with oldest-voice stealing and released nodes are disconnected. Heavy HPSS work runs off the main thread when Worker support is available.

## Release validation

GitHub CI performs JavaScript syntax validation, a static release preflight, and an HTTP entrypoint smoke test. The GitHub Pages workflow repeats syntax/preflight validation before publishing the static site.

The release preflight rejects missing core files, missing viewport metadata, unexpectedly missing application modules, and root-absolute URLs that would break project-subpath hosting.

## Current release boundary

The code-side browser MVP is implemented through the synth, sample/analyze/split/lanes workflow, project storage, worker processing, metering and MIDI support. Promotion to a fully accepted audio release still requires human checks that automation cannot honestly replace:

- by-ear synth, split and lane audio-quality review;
- real hardware MIDI-controller verification;
- by-eye browser/layout review on representative desktop/mobile browsers;
- confirmation that the deployed Pages build behaves the same as the tested static build.

These are acceptance gates, not missing Stage 2–5 implementation work.
