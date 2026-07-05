/* wubflipz — preset save/load
 * Captures the full engine state as JSON. Persists to localStorage and
 * supports downloadable .json files + file upload. UI refresh is delegated
 * to WF.UI.refreshAll() so knobs/selectors reflect a loaded preset.
 */
(function () {
  "use strict";
  const WF = (window.WF = window.WF || {});
  const LS_KEY = "wubflipz.preset.v1";
  const VERSION = 1;

  // every persisted parameter (mirrors engine state)
  const KEYS = [
    "oscA", "oscB", "detune", "mix", "octave",
    "subOn", "subWave", "subOctave", "subLevel",
    "cutoff", "q",
    "attack", "decay", "sustain", "release",
    "wobbleOn", "bpm", "halfTime", "wobbleDiv", "wobbleDepth", "wobbleWave",
    "growlAmount", "growlRate", "growlWave",
    "drive", "master",
  ];

  const stepRow = (...steps) => {
    const row = Array(16).fill(false);
    steps.forEach((s) => { if (s >= 0 && s < 16) row[s] = true; });
    return row;
  };
  const pattern = (rows) => Array.from({ length: 8 }, (_, i) => stepRow(...(rows[i] || [])));
  const pads = (levels, pitches) => Array.from({ length: 8 }, (_, i) => ({
    level: levels && levels[i] != null ? levels[i] : 0.85,
    pitch: pitches && pitches[i] != null ? pitches[i] : 0,
    sampleName: "",
  }));
  const preset = (name, params, seqRows, seq) => ({
    app: "wubflipz",
    version: VERSION,
    name,
    factory: true,
    params,
    sequencer: {
      sync: seq && seq.sync != null ? seq.sync : true,
      bpm: seq && seq.bpm ? seq.bpm : params.bpm,
      pattern: pattern(seqRows),
      pads: pads(seq && seq.levels, seq && seq.pitches),
    },
  });
  const baseParams = {
    oscA: "sawtooth", oscB: "square", detune: 9, mix: 0.4, octave: 0,
    subOn: true, subWave: "sine", subOctave: -1, subLevel: 0.85,
    cutoff: 700, q: 7,
    attack: 0.005, decay: 0.12, sustain: 0.85, release: 0.22,
    wobbleOn: true, bpm: 140, halfTime: false, wobbleDiv: "1/8", wobbleDepth: 0.7, wobbleWave: "sine",
    growlAmount: 0.0, growlRate: 14, growlWave: "triangle",
    drive: 0.18, master: 0.8,
  };
  const p = (overrides) => Object.assign({}, baseParams, overrides);
  const FACTORY = [
    preset("Riddim Grind", p({
      oscA: "square", oscB: "sawtooth", detune: -14, mix: 0.62, subLevel: 0.92,
      cutoff: 360, q: 10.5, attack: 0.003, decay: 0.09, sustain: 0.88, release: 0.12,
      bpm: 140, wobbleDiv: "1/4.", wobbleDepth: 0.52, wobbleWave: "square",
      growlAmount: 0.82, growlRate: 19, growlWave: "square", drive: 0.78, master: 0.74,
    }), [[0, 7, 10], [4, 12], [], [2, 6, 10, 14], [], [], [3, 11], []]),
    preset("Tearout Screech", p({
      oscA: "sawtooth", oscB: "sawtooth", detune: 23, mix: 0.78, subLevel: 0.66,
      cutoff: 1900, q: 18, attack: 0.002, decay: 0.06, sustain: 0.74, release: 0.07,
      bpm: 150, wobbleDiv: "1/16", wobbleDepth: 0.95, wobbleWave: "square",
      growlAmount: 0.95, growlRate: 42, growlWave: "triangle", drive: 0.88, master: 0.68,
    }), [[0, 4, 8, 12], [4, 10, 12], [6, 14], [0, 2, 4, 6, 8, 10, 12, 14], [15], [], [3, 7, 11], [0]], { levels: [0.95, 0.9, 0.72, 0.55, 0.45, 0.6, 0.65, 0.35] }),
    preset("Melodic Half-Time", p({
      oscA: "sine", oscB: "sawtooth", detune: 7, mix: 0.28, subLevel: 0.97,
      cutoff: 820, q: 4.2, attack: 0.01, decay: 0.22, sustain: 0.78, release: 0.78,
      bpm: 140, halfTime: true, wobbleDiv: "1/2.", wobbleDepth: 0.34, wobbleWave: "sine",
      growlAmount: 0.18, growlRate: 8, growlWave: "sine", drive: 0.14, master: 0.82,
    }), [[0, 8], [12], [4], [0, 4, 8, 12], [14], [6], [], []]),
    preset("Classic Brostep", p({
      oscA: "square", oscB: "square", detune: 16, mix: 0.58, subLevel: 0.82,
      cutoff: 760, q: 9, attack: 0.004, decay: 0.11, sustain: 0.82, release: 0.2,
      bpm: 140, wobbleDiv: "1/8T", wobbleDepth: 0.78, wobbleWave: "sine",
      growlAmount: 0.52, growlRate: 18, growlWave: "triangle", drive: 0.46, master: 0.78,
    }), [[0, 8, 11], [4, 12], [12], [0, 3, 6, 9, 12, 15], [7, 15], [], [2, 10], []]),
    preset("Deep Sub Roller", p({
      oscA: "sine", oscB: "triangle", detune: 0, mix: 0.12, subLevel: 1,
      cutoff: 240, q: 2.1, attack: 0.008, decay: 0.18, sustain: 0.94, release: 0.36,
      bpm: 140, halfTime: true, wobbleDiv: "1/2", wobbleDepth: 0.06, wobbleWave: "sine",
      growlAmount: 0.04, growlRate: 5, growlWave: "sine", drive: 0.05, master: 0.86,
    }), [[0, 10], [12], [], [2, 6, 10, 14], [], [7], [], []]),
    preset("Chaos Growl", p({
      oscA: "sawtooth", oscB: "square", detune: -31, mix: 0.7, subLevel: 0.74,
      cutoff: 520, q: 13.5, attack: 0.002, decay: 0.08, sustain: 0.86, release: 0.13,
      bpm: 145, wobbleDiv: "1/2", wobbleDepth: 0.62, wobbleWave: "triangle",
      growlAmount: 1, growlRate: 55, growlWave: "square", drive: 0.92, master: 0.68,
    }), [[0, 5, 8, 13], [4, 12], [11], [1, 3, 5, 7, 9, 11, 13, 15], [6, 14], [10], [2, 6, 10, 14], [0]], { levels: [0.9, 0.88, 0.7, 0.48, 0.42, 0.58, 0.66, 0.32] }),
    preset("Future Riddim Clean", p({
      oscA: "triangle", oscB: "sawtooth", detune: 12, mix: 0.46, subLevel: 0.88,
      cutoff: 1100, q: 6.5, attack: 0.006, decay: 0.1, sustain: 0.72, release: 0.18,
      bpm: 150, wobbleDiv: "1/16", wobbleDepth: 0.44, wobbleWave: "sine",
      growlAmount: 0.28, growlRate: 24, growlWave: "triangle", drive: 0.2, master: 0.8,
    }), [[0, 6, 8, 14], [4, 12], [], [0, 2, 4, 6, 8, 10, 12, 14], [15], [], [7], []]),
    preset("Swamp Stomp", p({
      oscA: "square", oscB: "triangle", detune: -7, mix: 0.5, subLevel: 0.94,
      cutoff: 310, q: 12, attack: 0.004, decay: 0.16, sustain: 0.9, release: 0.28,
      bpm: 138, halfTime: true, wobbleDiv: "1/1", wobbleDepth: 0.72, wobbleWave: "square",
      growlAmount: 0.68, growlRate: 11, growlWave: "triangle", drive: 0.66, master: 0.74,
    }), [[0, 9], [6, 12], [14], [0, 4, 8, 12], [15], [3, 11], [7], []]),
    preset("Neuro Snap", p({
      oscA: "sawtooth", oscB: "triangle", detune: 36, mix: 0.64, subLevel: 0.7,
      cutoff: 1450, q: 11, attack: 0.001, decay: 0.045, sustain: 0.62, release: 0.055,
      bpm: 172, wobbleDiv: "1/16T", wobbleDepth: 0.58, wobbleWave: "triangle",
      growlAmount: 0.74, growlRate: 33, growlWave: "sine", drive: 0.38, master: 0.72,
    }), [[0, 3, 8, 11], [4, 12], [6, 14], [0, 2, 3, 5, 6, 8, 10, 11, 13, 14], [7, 15], [], [1, 9], [0]], { levels: [0.82, 0.86, 0.68, 0.42, 0.35, 0.45, 0.62, 0.26] }),
  ];

  function capture(name) {
    const params = {};
    KEYS.forEach((k) => (params[k] = WF.state[k]));
    const sequencer = WF.Sequencer && WF.Sequencer.capture ? WF.Sequencer.capture() : null;
    return { app: "wubflipz", version: VERSION, name: name || "untitled", savedAt: new Date().toISOString(), params, sequencer };
  }

  function apply(preset) {
    if (!preset || !preset.params) throw new Error("Not a wubflipz preset");
    KEYS.forEach((k) => { if (k in preset.params) WF.state[k] = preset.params[k]; });
    if (WF.Sequencer && WF.Sequencer.apply) WF.Sequencer.apply(preset.sequencer);
    if (WF.Engine && WF.Engine.started) WF.Engine.syncAll();
    if (WF.UI && WF.UI.refreshAll) WF.UI.refreshAll();
  }

  function saveLocal(name) {
    const p = capture(name);
    try { localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch (e) { return false; }
    return true;
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return false;
      apply(JSON.parse(raw));
      return true;
    } catch (e) { return false; }
  }

  function download(name) {
    const p = capture(name);
    const blob = new Blob([JSON.stringify(p, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safe = (p.name || "wubflipz").replace(/[^a-z0-9_-]+/gi, "_");
    a.href = url; a.download = `wubflipz-${safe}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function uploadFrom(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try { apply(JSON.parse(reader.result)); resolve(true); }
        catch (e) { reject(e); }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  function loadFactory(name) {
    const preset = FACTORY.find((p) => p.name === name);
    if (!preset) return false;
    apply(preset);
    return true;
  }

  WF.Presets = { capture, apply, saveLocal, loadLocal, download, uploadFrom, loadFactory, KEYS, FACTORY };
})();
