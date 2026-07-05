/* wubflipz — Sound Fuzzer / preset breeding
 * Mutates synth params only. Sequencer mutation is deferred.
 */
(function () {
  "use strict";
  const WF = (window.WF = window.WF || {});
  const $ = (id) => document.getElementById(id);
  const DIVS = ["1/1", "1/2", "1/2.", "1/2T", "1/4", "1/4.", "1/4T", "1/8", "1/8.", "1/8T", "1/16", "1/16.", "1/16T"];
  const WAVES = {
    oscA: ["sine", "triangle", "sawtooth", "square"],
    oscB: ["sine", "triangle", "sawtooth", "square"],
    wobbleWave: ["sine", "triangle", "square"],
    growlWave: ["sine", "triangle", "square"],
    subWave: ["sine", "triangle", "square"],
  };
  const BOUNDS = {
    detune: { type: "linear", min: -80, max: 80, step: 18 },
    mix: { type: "linear", min: 0, max: 1, step: 0.18 },
    octave: { type: "int", min: -2, max: 1, step: 1 },
    subOctave: { type: "int", min: -3, max: 0, step: 1 },
    subLevel: { type: "linear", min: 0.45, max: 1, step: 0.12 },
    cutoff: { type: "log", min: 90, max: 6000, step: 0.42 },
    q: { type: "linear", min: 1.2, max: 18, step: 2.5 },
    attack: { type: "log", min: 0.001, max: 0.08, step: 0.7 },
    decay: { type: "log", min: 0.025, max: 0.65, step: 0.55 },
    sustain: { type: "linear", min: 0.35, max: 1, step: 0.12 },
    release: { type: "log", min: 0.025, max: 1.2, step: 0.6 },
    bpm: { type: "linear", min: 70, max: 180, step: 6 },
    wobbleDiv: { type: "division", values: DIVS, step: 1 },
    wobbleDepth: { type: "linear", min: 0, max: 1, step: 0.16 },
    growlAmount: { type: "linear", min: 0, max: 1, step: 0.18 },
    growlRate: { type: "log", min: 3, max: 60, step: 0.5 },
    drive: { type: "linear", min: 0, max: 0.95, step: 0.14 },
    master: { type: "linear", min: 0.45, max: 0.95, step: 0.06 },
    oscA: { type: "wave", values: WAVES.oscA, chance: 0.18 },
    oscB: { type: "wave", values: WAVES.oscB, chance: 0.18 },
    wobbleWave: { type: "wave", values: WAVES.wobbleWave, chance: 0.16 },
    growlWave: { type: "wave", values: WAVES.growlWave, chance: 0.16 },
    subWave: { type: "wave", values: WAVES.subWave, chance: 0.08 },
    subOn: { type: "bool", chance: 0.04 },
    wobbleOn: { type: "bool", chance: 0.03 },
    halfTime: { type: "bool", chance: 0.08 },
  };
  const MUTABLE = Object.keys(BOUNDS);
  let population = [], parentPreset = null, gen = 0;

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const rnd = (r) => (r || Math).random();
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function mutateValue(value, cfg, r) {
    if (cfg.type === "linear") return clamp((+value || 0) + (rnd(r) * 2 - 1) * cfg.step * (rnd(r) < 0.15 ? 2.4 : 1), cfg.min, cfg.max);
    if (cfg.type === "log") {
      const v = clamp(+value || cfg.min, cfg.min, cfg.max);
      return clamp(Math.exp(Math.log(v) + (rnd(r) * 2 - 1) * cfg.step * (rnd(r) < 0.15 ? 1.8 : 1)), cfg.min, cfg.max);
    }
    if (cfg.type === "int") return Math.round(clamp((+value || 0) + (rnd(r) < 0.5 ? -cfg.step : cfg.step), cfg.min, cfg.max));
    if (cfg.type === "division") {
      const i = Math.max(0, cfg.values.indexOf(value));
      const jump = rnd(r) < 0.15 ? 2 : 1;
      return cfg.values[clamp(i + (rnd(r) < 0.5 ? -jump : jump), 0, cfg.values.length - 1)];
    }
    if (cfg.type === "wave") return rnd(r) < cfg.chance ? cfg.values[Math.floor(rnd(r) * cfg.values.length)] : value;
    if (cfg.type === "bool") return rnd(r) < cfg.chance ? !value : value;
    return value;
  }

  function mutateParams(params, amount, r) {
    const out = Object.assign({}, params);
    const changed = [];
    MUTABLE.forEach((key) => {
      if (rnd(r) > (amount || 0.34)) return;
      const before = out[key];
      out[key] = mutateValue(out[key], BOUNDS[key], r);
      if (out[key] !== before) changed.push(key);
    });
    if (!changed.length) {
      const key = MUTABLE[Math.floor(rnd(r) * MUTABLE.length)];
      out[key] = mutateValue(out[key], BOUNDS[key], r);
      changed.push(key);
    }
    return { params: out, changed };
  }

  function assertBounds(params) {
    for (const [key, cfg] of Object.entries(BOUNDS)) {
      const v = params[key];
      if (cfg.type === "linear" || cfg.type === "log" || cfg.type === "int") {
        if (!isFinite(v) || v < cfg.min - 1e-9 || v > cfg.max + 1e-9) throw new Error(`${key} out of bounds: ${v}`);
      } else if (cfg.type === "division" || cfg.type === "wave") {
        if (!cfg.values.includes(v)) throw new Error(`${key} invalid: ${v}`);
      } else if (cfg.type === "bool" && typeof v !== "boolean") throw new Error(`${key} not boolean`);
    }
    return true;
  }

  function currentParent() {
    return WF.Presets.capture($("presetName") && $("presetName").value ? $("presetName").value : "Fuzzer Parent");
  }
  function makeVariant(seed, i, parents) {
    const m = mutateParams(seed.params, 0.36);
    const preset = clone(seed);
    preset.name = `Fuzz ${gen}.${i + 1}`;
    preset.params = m.params;
    preset.sequencer = clone(seed.sequencer); // v1: pattern mutation deferred
    return { id: `${Date.now()}-${i}-${Math.random().toString(16).slice(2)}`, preset, changed: m.changed, favorite: false, parents: parents || [] };
  }
  function generate() {
    parentPreset = currentParent(); gen++;
    population = Array.from({ length: 6 }, (_, i) => makeVariant(parentPreset, i));
    render();
  }
  function crossover(parents) {
    const child = clone(parents[0].preset);
    child.name = `Breed ${gen}`;
    for (const key of WF.Presets.KEYS) child.params[key] = parents[Math.floor(Math.random() * parents.length)].preset.params[key];
    const m = mutateParams(child.params, 0.18);
    child.params = m.params;
    return { child, changed: m.changed };
  }
  function breed() {
    const fav = population.filter((v) => v.favorite);
    if (fav.length < 2) { setMsg("Pick 2+ favorites first."); return; }
    gen++;
    const baseKids = Array.from({ length: 6 }, (_, i) => {
      const x = crossover(fav);
      x.child.name = `Breed ${gen}.${i + 1}`;
      return { id: `${Date.now()}-b-${i}`, preset: x.child, changed: x.changed, favorite: false, parents: fav.map((f) => f.preset.name) };
    });
    population = baseKids; render(); setMsg("Bred new generation.");
  }
  function audition(v) {
    const restore = WF.Presets.capture("pre-audition");
    WF.Presets.apply(v.preset);
    WF.Engine.ensureAudio();
    WF.Engine.noteOn(36, 0.9);
    setTimeout(() => WF.Engine.noteOff(36, true), 850);
    setTimeout(() => WF.Presets.apply(restore), 950);
  }
  function saveVariant(v) {
    WF.Presets.apply(v.preset);
    if ($("presetName")) $("presetName").value = v.preset.name;
    const ok = WF.Presets.saveLocal(v.preset.name);
    setMsg(ok ? `Saved ${v.preset.name}` : "Save failed");
  }
  function setMsg(msg) {
    const el = $("fuzzMsg"); if (el) el.textContent = msg;
  }
  function render() {
    const grid = $("fuzzGrid"); if (!grid) return;
    grid.innerHTML = "";
    if (!population.length) { grid.innerHTML = ""; setMsg("Generate variants from the current active preset."); return; }
    population.forEach((v, i) => {
      const card = document.createElement("div"); card.className = "fuzz-card" + (v.favorite ? " favorite" : "");
      card.innerHTML = `<div class="fuzz-head"><span>${v.preset.name}</span><label>Fav <input type="checkbox" class="fuzz-fav" ${v.favorite ? "checked" : ""}></label></div>
        <div class="fuzz-meta">Changed: ${v.changed.slice(0, 7).join(", ") || "subtle"}${v.changed.length > 7 ? "…" : ""}</div>
        <div class="fuzz-actions"><button class="fuzz-audition" type="button">Audition</button><button class="fuzz-load" type="button">Load</button><button class="fuzz-save" type="button">Save</button></div>`;
      card.querySelector(".fuzz-fav").addEventListener("change", (e) => { v.favorite = e.target.checked; card.classList.toggle("favorite", v.favorite); });
      card.querySelector(".fuzz-audition").addEventListener("click", () => audition(v));
      card.querySelector(".fuzz-load").addEventListener("click", () => WF.Presets.apply(v.preset));
      card.querySelector(".fuzz-save").addEventListener("click", () => saveVariant(v));
      grid.appendChild(card);
    });
    setMsg(`Generation ${gen}: favorite 2+ variants, then Breed.`);
  }
  function propertyTest(iterations, seedParams) {
    let params = seedParams ? Object.assign({}, seedParams) : currentParent().params;
    for (let i = 0; i < iterations; i++) { params = mutateParams(params, 0.8, { random: Math.random }).params; assertBounds(params); }
    return true;
  }

  function initUI() {
    $("fuzzGenerate").addEventListener("click", generate);
    $("fuzzBreed").addEventListener("click", breed);
    render();
  }

  WF.Fuzzer = { BOUNDS, mutateParams, mutateValue, assertBounds, propertyTest, generate, breed };
  if ($("fuzzerBoard")) initUI();
})();
