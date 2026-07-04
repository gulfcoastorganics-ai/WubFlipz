# wubflipz

A standalone dubstep **wobble-bass synth** — plain HTML/CSS/JS + Web Audio + Canvas.
No build step, no `node_modules`, no framework. Sibling to `wublabz` (this is a
separate directory and does **not** live inside that repo).

## Run

It's a static site. Open `index.html` directly, or serve it (recommended, so
`localStorage` presets and file upload behave normally):

```bash
cd ~/wubflipz
python3 -m http.server 4173   # any port in the 4000s (avoids wublabz's 3000/3001/3002)
# then open http://localhost:4173
```

Audio starts on your first interaction (browser autoplay policy). Click **Power**
or press any note.

## Play

- **Computer keyboard:** `A W S E D F T G Y H U J K …` (bottom row white, upper row
  black), `Z` / `X` shift octave. Fully polyphonic.
- **Mouse / touch:** click keys or drag across them.
- **Knobs:** drag up/down (hold **Shift** = fine), scroll wheel, double-click to
  reset, or focus + arrow keys.

## Modules

| Module | What it does |
|---|---|
| **Oscillators** | Two osc A+B, waveform each, Detune, equal-power Mix, ±3 Octave |
| **Sub Bass** | Always-on pure sine, own octave; **bypasses the wobble filter** so it stays steady |
| **Filter** | 24 dB low-pass, Cutoff + Resonance; target of the wobble/growl LFOs |
| **Wobble** | Tempo-synced LFO → cutoff. BPM, half-time, musical divisions (1/1–1/16 + dotted/triplet), Depth, LFO wave |
| **Growl** | Faster LFO layered on top: one Amount knob modulates cutoff + resonance + slight pitch drift; independent Rate |
| **Envelope** | ADSR amplitude with live shape graph |
| **Drive / Out** | tanh saturation (Drive), Master, limiter, oscilloscope, readouts |
| **Presets** | Save/Load JSON via `localStorage`, Download / Upload `.json` |

## Audio tools (Stages 2–5)

Below the synth: a small sample workstation, all client-side, no build step.

- **Sample** — drag-drop / browse to load audio; off-main-thread decode; peak waveform;
  transport (play/pause/stop), click-to-seek, drag-to-select loop region, zoom. Runs on
  its own AudioContext, separate from the synth.
- **Analyze** — detect tempo (spectral-flux onsets → autocorrelation) and key (chroma +
  Krumhansl-Schmuckler). Detected BPM fills the Wobble field; both are **editable
  estimates**. Toggle a beat **Grid** and **Snap** (loop/seek snap to beats).
- **Quick Split** — approximate, DSP-only (not ML) stem separation: HPSS (harmonic /
  percussive via median-filtered spectrogram) and Mid/Side (rough vocal remove / isolate).
- **Lanes** — one lane per track (original + splits) with waveform, volume, pan, mute,
  solo; all lanes share one sample-accurate playhead/transport.

See `STATUS_LOG.md` for build detail and `AUDIT_QUEUE.md` for what still needs a human
by-ear / by-eye pass (audio quality is never self-certified here).

## Architecture

```
per voice:  oscA \                                    sub bypasses the wobble filter
            oscB  > mix -> VCA(ADSR) -> [ modFilter ] ----\
            subOsc -> subVCA(ADSR) -> subBus --------------> preBus -> shaper -> master -> limiter -> scope -> out

wobbleLFO -> depth ----------------> modFilter.detune   (tempo-synced cents)
growlLFO  -> amount -> cutoff -----> modFilter.detune
                    -> reso -------> modFilter.Q
                    -> pitch ------> (per voice) osc detune
```

- `engine.js` — Web Audio graph, voice lifecycle, modulation, live params.
- `presets.js` — state capture/restore, localStorage + file I/O.
- `ui.js` — knobs, selectors, keyboard, canvases, preset wiring.

Voices are capped (16) with oldest-voice stealing, and every node is explicitly
disconnected on envelope release to avoid long-session graph leaks.

## Status

Stage 1 built; **awaiting by-ear validation** before Stage 2. See `STATUS_LOG.md`.
