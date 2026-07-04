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

  function capture(name) {
    const params = {};
    KEYS.forEach((k) => (params[k] = WF.state[k]));
    return { app: "wubflipz", version: VERSION, name: name || "untitled", savedAt: new Date().toISOString(), params };
  }

  function apply(preset) {
    if (!preset || !preset.params) throw new Error("Not a wubflipz preset");
    KEYS.forEach((k) => { if (k in preset.params) WF.state[k] = preset.params[k]; });
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

  WF.Presets = { capture, apply, saveLocal, loadLocal, download, uploadFrom, KEYS };
})();
