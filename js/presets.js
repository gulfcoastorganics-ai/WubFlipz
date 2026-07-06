/* wubflipz — preset save/load
 * Captures the full engine state as JSON. Persists to localStorage and
 * supports downloadable .json files + file upload. UI refresh is delegated
 * to WF.UI.refreshAll() so knobs/selectors reflect a loaded preset.
 */
(function () {
  "use strict";
  const WF = (window.WF = window.WF || {});
  const LS_KEY = "wubflipz.preset.v1";
  const LS_LIBRARY = "wubflipz.preset.library.v1";
  const LS_BROWSER = "wubflipz.preset.browser.v1";
  const VERSION = 1;
  const CATEGORIES = ["Bass", "Growl", "Wobble", "Lead", "FX", "Pad", "Drum"];

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
  const FACTORY_META = {
    "Riddim Grind": { category: "Bass", tags: ["riddim", "syncopated", "heavy", "sub"], description: "Slow dotted grind with heavy growl and a steady sub foundation.", bpm: 140, key: "F minor", character: "Aggressive", genre: "Riddim", popularity: 98 },
    "Tearout Screech": { category: "Growl", tags: ["tearout", "screech", "bright", "fast"], description: "Fast 1/16 tearout screech with high resonance and sharp pitch drift.", bpm: 150, key: "F# minor", character: "Savage", genre: "Tearout", popularity: 94 },
    "Melodic Half-Time": { category: "Pad", tags: ["melodic", "half-time", "clean", "sub"], description: "Cleaner half-time patch with longer release and clear sub priority.", bpm: 140, key: "C minor", character: "Smooth", genre: "Melodic Dubstep", popularity: 87 },
    "Classic Brostep": { category: "Wobble", tags: ["brostep", "triplet", "square", "2012"], description: "Square-driven triplet wobble for a classic 2012-era reference tone.", bpm: 140, key: "D minor", character: "Punchy", genre: "Brostep", popularity: 91 },
    "Deep Sub Roller": { category: "Bass", tags: ["roller", "deep", "minimal", "sub"], description: "Near-static sub-forward roller with minimal drive and movement.", bpm: 140, key: "G minor", character: "Deep", genre: "140", popularity: 89 },
    "Chaos Growl": { category: "Growl", tags: ["chaos", "fast-growl", "dirty", "heavy"], description: "Slow wobble under fast growl modulation for unstable heavy movement.", bpm: 145, key: "E minor", character: "Chaotic", genre: "Dubstep", popularity: 96 },
    "Future Riddim Clean": { category: "Lead", tags: ["future", "clean", "fast", "riddim"], description: "Fast but controlled clean riddim tone with restrained drive.", bpm: 150, key: "A minor", character: "Clean", genre: "Future Riddim", popularity: 82 },
    "Swamp Stomp": { category: "FX", tags: ["swamp", "slow", "dirty", "half-time"], description: "Slow dirty stomp with square wobble and murky low-mid bite.", bpm: 138, key: "D# minor", character: "Dirty", genre: "Dubstep", popularity: 80 },
    "Neuro Snap": { category: "Drum", tags: ["neuro", "snappy", "fast", "percussive"], description: "Fast percussive neuro-style snap with tight envelope movement.", bpm: 172, key: "B minor", character: "Snappy", genre: "Neuro", popularity: 84 },
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function uid(name) { return String(name || "preset").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "preset"; }
  function inferCategory(p) {
    const n = String(p.name || "").toLowerCase();
    if (n.includes("growl") || (p.params && p.params.growlAmount > 0.65)) return "Growl";
    if (n.includes("wobble") || (p.params && p.params.wobbleDepth > 0.55)) return "Wobble";
    if (n.includes("lead") || (p.params && p.params.cutoff > 1000)) return "Lead";
    if (n.includes("pad") || (p.params && p.params.release > 0.7)) return "Pad";
    if (n.includes("drum") || n.includes("snap")) return "Drum";
    if (n.includes("fx") || n.includes("screech")) return "FX";
    return "Bass";
  }
  function normalizeMeta(p, source) {
    const m = Object.assign({}, p.metadata || {}, FACTORY_META[p.name] || {});
    const params = p.params || {};
    const category = CATEGORIES.includes(m.category) ? m.category : inferCategory(p);
    const tags = Array.from(new Set([].concat(m.tags || [], category, params.wobbleDepth > 0.6 ? "wobble" : [], params.growlAmount > 0.55 ? "growl" : [], params.subLevel > 0.85 ? "sub" : []).filter(Boolean).map((t) => String(t).trim()).filter(Boolean)));
    return {
      category,
      tags,
      description: m.description || "User preset.",
      bpm: isFinite(m.bpm) ? m.bpm : (isFinite(params.bpm) ? params.bpm : ""),
      key: m.key || "—",
      character: m.character || (params.drive > 0.55 ? "Dirty" : "Balanced"),
      genre: m.genre || "Dubstep",
      author: m.author || (source === "factory" ? "wubflipz" : "User"),
      popularity: isFinite(m.popularity) ? m.popularity : 0,
    };
  }
  function normalizePreset(p, source) {
    const out = clone(p);
    out.app = out.app || "wubflipz"; out.version = out.version || VERSION;
    out.name = out.name || "untitled";
    out.id = out.id || `${source}:${uid(out.name)}`;
    out.source = source || (out.factory ? "factory" : "user");
    out.factory = out.source === "factory";
    out.savedAt = out.savedAt || out.createdAt || "";
    out.metadata = normalizeMeta(out, out.source);
    return out;
  }
  function readJson(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch (e) { return fallback; }
  }
  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }
  function browserState() {
    const s = readJson(LS_BROWSER, {});
    return { favorites: s.favorites || {}, recent: Array.isArray(s.recent) ? s.recent : [], selectedId: s.selectedId || "", activeId: s.activeId || "" };
  }
  function saveBrowserState(s) { return writeJson(LS_BROWSER, s); }
  function userLibrary() {
    const list = readJson(LS_LIBRARY, []);
    return Array.isArray(list) ? list.map((p) => normalizePreset(p, "user")) : [];
  }
  function saveUserLibrary(list) { return writeJson(LS_LIBRARY, list.map((p) => normalizePreset(p, "user"))); }
  function factoryLibrary() { return FACTORY.map((p) => normalizePreset(p, "factory")); }
  function allPresets() {
    const legacy = loadLegacyPreset();
    const users = userLibrary();
    if (legacy && !users.some((p) => p.id === legacy.id)) users.push(legacy);
    return factoryLibrary().concat(users);
  }
  function loadLegacyPreset() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      const p = normalizePreset(JSON.parse(raw), "user");
      p.id = p.id || `user:${uid(p.name)}`;
      return p;
    } catch (e) { return null; }
  }

  function capture(name) {
    const params = {};
    KEYS.forEach((k) => (params[k] = WF.state[k]));
    const sequencer = WF.Sequencer && WF.Sequencer.capture ? WF.Sequencer.capture() : null;
    const now = new Date().toISOString();
    return normalizePreset({ app: "wubflipz", version: VERSION, name: name || "untitled", savedAt: now, params, sequencer }, "user");
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
    p.id = `user:${uid(p.name)}:${Date.now()}`;
    const list = userLibrary();
    list.unshift(p);
    if (!writeJson(LS_KEY, p)) return false;
    return saveUserLibrary(list);
  }

  function loadLocal() {
    try {
      const s = browserState();
      const p = allPresets().find((x) => x.id === s.selectedId) || userLibrary()[0] || loadLegacyPreset();
      if (!p) return false;
      apply(p); markUsed(p.id);
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
        try {
          const p = normalizePreset(JSON.parse(reader.result), "user");
          apply(p);
          const list = userLibrary(); list.unshift(Object.assign(p, { id: `user:${uid(p.name)}:${Date.now()}` }));
          saveUserLibrary(list); markUsed(list[0].id);
          resolve(true);
        }
        catch (e) { reject(e); }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  function bytesToBinary(bytes) {
    let out = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return out;
  }

  function encodePatch(preset) {
    const json = JSON.stringify(preset);
    const bin = bytesToBinary(new TextEncoder().encode(json));
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function decodePatch(encoded) {
    const safe = String(encoded || "").replace(/-/g, "+").replace(/_/g, "/");
    const padded = safe + "=".repeat((4 - (safe.length % 4)) % 4);
    const bin = atob(padded);
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  function patchUrl(name) {
    const p = capture(name || "shared-patch");
    const url = new URL(window.location.href);
    url.hash = "patch=" + encodePatch(p);
    return url.toString();
  }

  function copyShareLink(name) {
    const url = patchUrl(name);
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(url).then(() => url);
    const ta = document.createElement("textarea");
    ta.value = url; ta.setAttribute("readonly", "readonly"); ta.style.position = "fixed"; ta.style.left = "-9999px";
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } finally { ta.remove(); }
    return ok ? Promise.resolve(url) : Promise.reject(new Error("Clipboard unavailable"));
  }

  function loadFromHash() {
    const hash = (window.location && window.location.hash ? window.location.hash : "").replace(/^#/, "");
    if (!hash) return false;
    const encoded = new URLSearchParams(hash).get("patch");
    if (!encoded) return false;
    try {
      const p = decodePatch(encoded);
      apply(p); markUsed(normalizePreset(p, p.factory ? "factory" : "user").id);
      return p;
    } catch (e) {
      console.warn("Invalid wubflipz patch hash", e);
      return false;
    }
  }

  function loadFactory(name) {
    const preset = FACTORY.find((p) => p.name === name);
    if (!preset) return false;
    const p = normalizePreset(preset, "factory");
    apply(p); markUsed(p.id);
    return true;
  }

  function loadById(id) {
    const p = allPresets().find((x) => x.id === id);
    if (!p) return false;
    apply(p); markUsed(id);
    return p;
  }
  function markUsed(id) {
    const s = browserState();
    s.activeId = id; s.selectedId = id;
    s.recent = [id].concat((s.recent || []).filter((x) => x !== id)).slice(0, 12);
    saveBrowserState(s);
  }
  function toggleFavorite(id) {
    const s = browserState();
    s.favorites[id] ? delete s.favorites[id] : (s.favorites[id] = Date.now());
    saveBrowserState(s);
    return !!s.favorites[id];
  }
  function setSelected(id) {
    const s = browserState(); s.selectedId = id; saveBrowserState(s);
  }
  function listPresets(filters) {
    const f = Object.assign({ query: "", category: "All", source: "All", sort: "Name", tag: "", recent: false, favorites: false }, filters || {});
    const s = browserState();
    const q = f.query.trim().toLowerCase();
    let list = allPresets().map((p) => Object.assign({}, p, {
      favorite: !!s.favorites[p.id],
      recentIndex: s.recent.indexOf(p.id),
    }));
    if (f.recent) list = list.filter((p) => p.recentIndex >= 0);
    if (f.favorites) list = list.filter((p) => p.favorite);
    if (f.category !== "All") list = list.filter((p) => p.metadata.category === f.category);
    if (f.source !== "All") list = list.filter((p) => p.source === f.source.toLowerCase());
    if (f.tag) list = list.filter((p) => p.metadata.tags.includes(f.tag));
    if (q) list = list.filter((p) => [p.name, p.metadata.description, p.metadata.author, p.metadata.genre, p.metadata.character].concat(p.metadata.tags).join(" ").toLowerCase().includes(q));
    const byDate = (p) => Date.parse(p.savedAt || "2000-01-01") || 0;
    const sorters = {
      Name: (a, b) => a.name.localeCompare(b.name),
      Date: (a, b) => byDate(b) - byDate(a),
      Author: (a, b) => a.metadata.author.localeCompare(b.metadata.author) || a.name.localeCompare(b.name),
      Popularity: (a, b) => (b.metadata.popularity || 0) - (a.metadata.popularity || 0) || a.name.localeCompare(b.name),
    };
    list.sort(sorters[f.sort] || sorters.Name);
    return list;
  }
  function allTags() {
    return Array.from(new Set(allPresets().flatMap((p) => p.metadata.tags))).sort((a, b) => a.localeCompare(b));
  }

  WF.Presets = {
    capture, apply, saveLocal, loadLocal, download, uploadFrom, loadFactory,
    allPresets, listPresets, allTags, loadById, toggleFavorite, setSelected, browserState,
    encodePatch, decodePatch, patchUrl, copyShareLink, loadFromHash,
    KEYS, FACTORY, CATEGORIES,
  };
})();
