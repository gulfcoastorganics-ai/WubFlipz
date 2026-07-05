/* wubflipz — UI layer
 * Draggable knobs, selectors, toggles, keyboard, live canvases, preset wiring.
 * Talks to WF.Engine + WF.Presets. Exposes WF.UI.refreshAll() for preset loads.
 */
(function () {
  "use strict";
  const WF = (window.WF = window.WF || {});
  const state = WF.state;
  const E = WF.Engine;
  const $ = (id) => document.getElementById(id);

  // -------------------------------------------------------------- formatting
  function fmt(param, v) {
    switch (param) {
      case "cutoff": return v >= 1000 ? (v / 1000).toFixed(1) + " kHz" : Math.round(v) + " Hz";
      case "q": return v.toFixed(1);
      case "attack": case "decay": case "release": return v < 1 ? Math.round(v * 1000) + " ms" : v.toFixed(2) + " s";
      case "sustain": case "subLevel": case "master": case "wobbleDepth": case "growlAmount": case "drive":
        return Math.round(v * 100) + " %";
      case "detune": return (v > 0 ? "+" : "") + Math.round(v) + " ct";
      case "mix": return Math.round(v * 100) + "% B";
      case "growlRate": return v.toFixed(1) + " Hz";
      default: return (+v).toFixed(2);
    }
  }

  // -------------------------------------------------------------- knob
  const KNOB_SVG = `
    <svg class="knob-svg" viewBox="0 0 100 100">
      <circle class="knob-face" cx="50" cy="50" r="44"/>
      <path class="knob-track" pathLength="100" d="M23.13 76.87 A38 38 0 1 1 76.87 76.87"/>
      <path class="knob-arc"   pathLength="100" d="M23.13 76.87 A38 38 0 1 1 76.87 76.87"/>
      <g class="knob-pointer"><line x1="50" y1="50" x2="28.79" y2="71.21"/></g>
      <circle class="knob-cap" cx="50" cy="50" r="7"/>
    </svg>`;
  const knobs = {};

  class Knob {
    constructor(el) {
      this.el = el;
      this.param = el.dataset.param;
      this.min = +el.dataset.min; this.max = +el.dataset.max;
      this.curve = el.dataset.curve || "lin";
      this.def = +el.dataset.default;
      el.innerHTML = KNOB_SVG +
        `<div class="knob-label">${el.dataset.label || this.param}</div>` +
        `<div class="knob-val"></div>`;
      this.arc = el.querySelector(".knob-arc");
      this.ptr = el.querySelector(".knob-pointer");
      this.valEl = el.querySelector(".knob-val");
      this.syncFromState(false);
      this.bind();
      knobs[this.param] = this;
    }
    valToT(v) { return this.curve === "log" ? Math.log(v / this.min) / Math.log(this.max / this.min) : (v - this.min) / (this.max - this.min); }
    tToVal(t) { return this.curve === "log" ? this.min * Math.pow(this.max / this.min, t) : this.min + (this.max - this.min) * t; }
    value() { return this.tToVal(this.t); }
    render() {
      const v = this.value();
      this.arc.setAttribute("stroke-dasharray", `${(this.t * 100).toFixed(2)} 100`);
      this.ptr.setAttribute("transform", `rotate(${(this.t * 270).toFixed(2)} 50 50)`);
      this.valEl.textContent = fmt(this.param, v);
      this.el.setAttribute("aria-valuenow", v.toFixed(this.param === "cutoff" ? 0 : 3));
      this.el.setAttribute("aria-valuetext", fmt(this.param, v));
    }
    set(t, live = true) {
      this.t = Math.min(1, Math.max(0, t));
      state[this.param] = this.value();
      this.render();
      if (live) { E.onParam(this.param); onKnobSide(this.param); }
    }
    syncFromState(live) { this.t = this.valToT(state[this.param]); this.render(); if (live) E.onParam(this.param); }
    bind() {
      const el = this.el; let startY = 0, startT = 0, dragging = false;
      const move = (e) => {
        if (!dragging) return;
        const y = e.touches ? e.touches[0].clientY : e.clientY;
        const fine = e.shiftKey ? 5 : 1;
        this.set(startT + (startY - y) / (220 * fine));
        e.preventDefault();
      };
      const up = () => { dragging = false; window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
      el.addEventListener("pointerdown", (e) => { dragging = true; startY = e.clientY; startT = this.t; el.focus(); window.addEventListener("pointermove", move, { passive: false }); window.addEventListener("pointerup", up); e.preventDefault(); });
      el.addEventListener("wheel", (e) => { this.set(this.t - Math.sign(e.deltaY) * (e.shiftKey ? 0.005 : 0.03)); e.preventDefault(); }, { passive: false });
      el.addEventListener("dblclick", () => this.set(this.valToT(this.def)));
      el.addEventListener("keydown", (e) => {
        const step = e.shiftKey ? 0.005 : 0.03;
        if (e.key === "ArrowUp" || e.key === "ArrowRight") { this.set(this.t + step); e.preventDefault(); }
        else if (e.key === "ArrowDown" || e.key === "ArrowLeft") { this.set(this.t - step); e.preventDefault(); }
        else if (e.key === "Home") { this.set(0); e.preventDefault(); }
        else if (e.key === "End") { this.set(1); e.preventDefault(); }
      });
    }
  }

  function onKnobSide(param) {
    if (["attack", "decay", "sustain", "release"].includes(param)) drawEnv();
  }

  document.querySelectorAll(".knob").forEach((el) => new Knob(el));

  // -------------------------------------------------------------- wave selectors
  const WAVE_ICON = {
    sine: "M2 12 C6 2, 10 22, 14 12 S 20 2, 22 12",
    triangle: "M2 18 L7 6 L12 18 L17 6 L22 18",
    sawtooth: "M2 18 L8 6 L8 18 L14 6 L14 18 L20 6 L20 18",
    square: "M2 18 L2 6 L8 6 L8 18 L14 18 L14 6 L20 6 L20 18",
  };
  const selectors = []; // {box, key}
  function buildWaveSelector(id, key, waves) {
    const box = $(id); if (!box) return;
    box.innerHTML = "";
    waves.forEach((w) => {
      const b = document.createElement("button");
      b.type = "button"; b.title = w; b.setAttribute("aria-label", w); b.dataset.wave = w;
      b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="${WAVE_ICON[w]}"/></svg>`;
      if (state[key] === w) b.classList.add("active");
      b.addEventListener("click", () => {
        state[key] = w; E.onParam(key);
        [...box.children].forEach((c) => c.classList.remove("active")); b.classList.add("active");
      });
      box.appendChild(b);
    });
    selectors.push({ box, key });
  }
  buildWaveSelector("oscA", "oscA", ["sine", "triangle", "sawtooth", "square"]);
  buildWaveSelector("oscB", "oscB", ["sine", "triangle", "sawtooth", "square"]);
  buildWaveSelector("wobbleWave", "wobbleWave", ["sine", "triangle", "square"]);
  buildWaveSelector("growlWave", "growlWave", ["sine", "triangle", "square"]);

  // -------------------------------------------------------------- octave controls
  const octCtls = []; // {key, valEl, extra}
  function bindOctave(key, valId, dnId, upId, min, max, extra) {
    const valEl = $(valId);
    const setDisp = () => { valEl.textContent = (state[key] > 0 ? "+" : "") + state[key]; };
    const upd = () => { setDisp(); if (extra) extra(); };
    $(dnId).addEventListener("click", () => { state[key] = Math.max(min, state[key] - 1); E.onParam(key); upd(); });
    $(upId).addEventListener("click", () => { state[key] = Math.min(max, state[key] + 1); E.onParam(key); upd(); });
    // init: display only. `extra` (e.g. relabelKeys) must not run before the keyboard
    // is built later in this IIFE — buildKeyboard() labels the keys itself.
    octCtls.push({ key, upd }); setDisp();
  }
  bindOctave("octave", "octval", "octdn", "octup", -3, 3, () => relabelKeys());
  bindOctave("subOctave", "suboctval", "suboctdn", "suboctup", -3, 1);

  // -------------------------------------------------------------- toggles
  const toggles = []; // {key, el, on, off}
  function bindToggle(id, key, onTxt, offTxt, cb) {
    const el = $(id);
    const upd = () => { el.classList.toggle("on", !!state[key]); el.textContent = state[key] ? onTxt : offTxt; el.setAttribute("aria-pressed", state[key] ? "true" : "false"); };
    el.addEventListener("click", () => { state[key] = !state[key]; E.onParam(key); upd(); if (cb) cb(); });
    toggles.push({ key, upd }); upd();
  }
  bindToggle("wobbleOn", "wobbleOn", "Wobble On", "Wobble Off");
  bindToggle("subOn", "subOn", "Sub On", "Sub Off");
  bindToggle("halfTime", "halfTime", "Half-Time", "Normal", () => updateRateReadout());

  // -------------------------------------------------------------- bpm + division
  const bpmInput = $("bpm");
  bpmInput.value = state.bpm;
  bpmInput.addEventListener("input", () => {
    let v = parseFloat(bpmInput.value); if (!isFinite(v)) return;
    v = Math.min(300, Math.max(40, v)); state.bpm = v; E.onParam("bpm"); updateRateReadout();
  });
  const divSel = $("wobbleDiv");
  Object.keys(WF.WOBBLE_DIVS).forEach((k) => {
    const o = document.createElement("option"); o.value = k;
    o.textContent = k.replace("T", " (triplet)").replace(".", " (dotted)");
    divSel.appendChild(o);
  });
  divSel.value = state.wobbleDiv;
  divSel.addEventListener("change", () => { state.wobbleDiv = divSel.value; E.onParam("wobbleDiv"); updateRateReadout(); });

  function updateRateReadout() {
    const hz = E.wobbleHz();
    $("rateReadout").textContent = hz.toFixed(2) + " Hz";
  }

  // -------------------------------------------------------------- presets
  $("presetSave").addEventListener("click", () => {
    const ok = WF.Presets.saveLocal($("presetName").value || "untitled");
    flash($("presetMsg"), ok ? "Saved to browser" : "Save failed");
  });
  $("presetLoad").addEventListener("click", () => {
    const ok = WF.Presets.loadLocal();
    flash($("presetMsg"), ok ? "Loaded from browser" : "No saved preset");
  });
  $("presetDownload").addEventListener("click", () => {
    WF.Presets.download($("presetName").value || "untitled");
    flash($("presetMsg"), "Downloaded .json");
  });
  $("presetShare").addEventListener("click", () => {
    WF.Presets.copyShareLink($("presetName").value || "shared-patch")
      .then(() => flash($("presetMsg"), "Share link copied"))
      .catch(() => flash($("presetMsg"), "Copy failed"));
  });
  $("presetFile").addEventListener("change", (e) => {
    const f = e.target.files[0]; if (!f) return;
    WF.Presets.uploadFrom(f).then(() => { $("presetName").value = (f.name || "").replace(/\.json$/i, ""); flash($("presetMsg"), "Loaded " + f.name); })
      .catch(() => flash($("presetMsg"), "Invalid preset file"));
    e.target.value = "";
  });
  const factorySel = $("factoryPreset");
  WF.Presets.FACTORY.forEach((p) => {
    const o = document.createElement("option"); o.value = p.name; o.textContent = p.name; factorySel.appendChild(o);
  });
  $("factoryLoad").addEventListener("click", () => {
    const ok = WF.Presets.loadFactory(factorySel.value);
    $("presetName").value = factorySel.value;
    flash($("presetMsg"), ok ? "Loaded factory" : "Factory load failed");
  });
  let flashTimer = null;
  function flash(el, msg) { el.textContent = msg; clearTimeout(flashTimer); flashTimer = setTimeout(() => (el.textContent = ""), 2600); }

  // -------------------------------------------------------------- refresh (after preset load)
  WF.UI = {
    refreshAll() {
      Object.values(knobs).forEach((k) => k.syncFromState(false));
      selectors.forEach(({ box, key }) => [...box.children].forEach((c) => c.classList.toggle("active", c.dataset.wave === state[key])));
      octCtls.forEach((o) => o.upd());
      toggles.forEach((t) => t.upd());
      bpmInput.value = state.bpm;
      divSel.value = state.wobbleDiv;
      updateRateReadout(); drawEnv(); relabelKeys();
    },
  };

  // -------------------------------------------------------------- keyboard
  const WHITE = [0, 2, 4, 5, 7, 9, 11];
  const HAS_BLACK = { 0: true, 1: true, 3: true, 4: true, 5: true };
  const BASE = 36; // C2 — bass range
  const OCTAVES = 2;
  const totalWhites = WHITE.length * OCTAVES + 1;
  const KEYMAP = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14, p: 15, ";": 16, "'": 17 };
  const OFF2KEY = {}; for (const k in KEYMAP) if (OFF2KEY[KEYMAP[k]] === undefined) OFF2KEY[KEYMAP[k]] = k;

  const keysEl = $("keys");
  const keyEls = new Map(); // offset -> element
  function noteName(m) { const NM = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"]; return NM[m % 12] + (Math.floor(m / 12) - 1); }

  function buildKeyboard() {
    keysEl.innerHTML = ""; keyEls.clear();
    const ww = 100 / totalWhites; let wcount = 0;
    for (let o = 0; o < OCTAVES; o++) {
      for (let i = 0; i < WHITE.length; i++) {
        const off = o * 12 + WHITE[i];
        const wk = document.createElement("div"); wk.className = "wkey"; wk.dataset.off = off; wk.innerHTML = `<span class="lab"></span>`;
        keysEl.appendChild(wk); keyEls.set(off, wk); wcount++;
        if (HAS_BLACK[i]) {
          const boff = off + 1;
          const bk = document.createElement("div"); bk.className = "bkey"; bk.dataset.off = boff; bk.innerHTML = `<span class="lab"></span>`;
          const bw = ww * 0.62;
          bk.style.left = `calc(${(wcount * ww).toFixed(4)}% - ${(bw / 2).toFixed(4)}%)`;
          bk.style.width = bw.toFixed(4) + "%";
          keysEl.appendChild(bk); keyEls.set(boff, bk);
        }
      }
    }
    const off = OCTAVES * 12;
    const wk = document.createElement("div"); wk.className = "wkey"; wk.dataset.off = off; wk.innerHTML = `<span class="lab"></span>`;
    keysEl.appendChild(wk); keyEls.set(off, wk);
    relabelKeys(); bindKeyPointers();
  }
  function relabelKeys() {
    for (const [off, el] of keyEls) {
      const midi = BASE + state.octave * 12 + off;
      const letter = OFF2KEY[off];
      el.querySelector(".lab").textContent = letter ? letter.toUpperCase() : (el.classList.contains("wkey") ? noteName(midi) : "");
      el.dataset.midi = midi;
    }
  }

  const pressed = new Set();
  function press(midi) { if (pressed.has(midi)) return; pressed.add(midi); E.noteOn(midi); markKey(midi, true); }
  function release(midi) { if (!pressed.has(midi)) return; pressed.delete(midi); E.noteOff(midi); markKey(midi, false); }
  function clearPressedKeys() { for (const m of [...pressed]) { pressed.delete(m); markKey(m, false); } }
  function markKey(midi, down) { const off = midi - (BASE + state.octave * 12); const el = keyEls.get(off); if (el) el.classList.toggle("down", down); }

  function bindKeyPointers() {
    let mouseDown = false;
    const midiFromEvent = (e) => { const k = e.target.closest("[data-midi]"); return k ? +k.dataset.midi : null; };
    keysEl.addEventListener("pointerdown", (e) => { E.ensureAudio(); mouseDown = true; const m = midiFromEvent(e); if (m != null) press(m); e.preventDefault(); });
    keysEl.addEventListener("pointerover", (e) => { if (!mouseDown) return; const m = midiFromEvent(e); if (m != null) press(m); });
    keysEl.addEventListener("pointerout", (e) => { if (!mouseDown) return; const m = midiFromEvent(e); if (m != null) release(m); });
    window.addEventListener("pointerup", () => { if (!mouseDown) return; mouseDown = false; for (const m of [...pressed]) release(m); });
  }
  buildKeyboard();

  window.addEventListener("keydown", (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = e.target.tagName || ""; if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    const k = e.key.toLowerCase();
    if (k === "z") { $("octdn").click(); return; }
    if (k === "x") { $("octup").click(); return; }
    if (k in KEYMAP) { E.ensureAudio(); press(BASE + state.octave * 12 + KEYMAP[k]); e.preventDefault(); }
  });
  window.addEventListener("keyup", (e) => { const k = e.key.toLowerCase(); if (k in KEYMAP) release(BASE + state.octave * 12 + KEYMAP[k]); });
  window.addEventListener("blur", () => { for (const m of [...pressed]) release(m); E.allNotesOff(); });
  window.addEventListener("wf:emergency-stop", clearPressedKeys);

  // -------------------------------------------------------------- power + readouts
  function setStatus(on) {
    $("led").classList.toggle("on", on);
    $("status").textContent = on ? "Live" : "Standby";
    const b = $("pwr"); b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); b.textContent = on ? "On" : "Power";
    $("scopeState").textContent = on ? "● running" : "— idle";
  }
  $("pwr").addEventListener("click", () => { E.ensureAudio(); if (E.ctx && E.ctx.state === "suspended") E.ctx.resume().then(() => setStatus(true)); else setStatus(true); });

  E._onStart = () => {
    setStatus(true);
    $("srate").textContent = (E.ctx.sampleRate / 1000).toFixed(1) + " kHz";
    $("baseLat").textContent = E.ctx.baseLatency ? Math.round(E.ctx.baseLatency * 1000) + " ms" : "interactive";
    updateRateReadout();
  };
  E._onVoices = (n) => { $("voices").textContent = n + (n === 1 ? " voice" : " voices") + " / " + E.MAX_VOICES; };
  $("voices").textContent = "0 voices / " + E.MAX_VOICES;

  // -------------------------------------------------------------- canvases
  const envcv = $("envcv"), envx = envcv.getContext("2d");
  const scopecv = $("scope"), scx = scopecv.getContext("2d");
  function sizeCanvas(cv) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = cv.getBoundingClientRect();
    cv.width = Math.max(1, Math.round(r.width * dpr)); cv.height = Math.max(1, Math.round(r.height * dpr));
    return dpr;
  }
  function drawEnv() {
    const dpr = sizeCanvas(envcv), W = envcv.width, H = envcv.height, pad = 8 * dpr;
    envx.clearRect(0, 0, W, H);
    envx.strokeStyle = "rgba(111,228,166,0.12)"; envx.lineWidth = 1 * dpr;
    for (let i = 1; i < 4; i++) { const y = pad + (H - 2 * pad) * i / 4; envx.beginPath(); envx.moveTo(pad, y); envx.lineTo(W - pad, y); envx.stroke(); }
    const a = state.attack, d = state.decay, s = state.sustain, r = state.release;
    const total = a + d + 0.4 + r;
    const tx = (t) => pad + (W - 2 * pad) * (t / total), ty = (v) => (H - pad) - (H - 2 * pad) * v;
    envx.lineWidth = 2 * dpr; envx.strokeStyle = "#f6b23c"; envx.shadowColor = "rgba(246,178,60,0.6)"; envx.shadowBlur = 6 * dpr;
    envx.beginPath();
    envx.moveTo(tx(0), ty(0)); envx.lineTo(tx(a), ty(1)); envx.lineTo(tx(a + d), ty(s)); envx.lineTo(tx(a + d + 0.4), ty(s)); envx.lineTo(tx(total), ty(0));
    envx.stroke(); envx.shadowBlur = 0;
    envx.fillStyle = "#ffe1a6";
    [[tx(a), ty(1)], [tx(a + d), ty(s)], [tx(a + d + 0.4), ty(s)]].forEach(([x, y]) => { envx.beginPath(); envx.arc(x, y, 2.4 * dpr, 0, 7); envx.fill(); });
    $("envState").textContent = `${Math.round(a * 1000)}·${Math.round(d * 1000)}·${Math.round(s * 100)}%·${Math.round(r * 1000)}`;
  }
  function drawScope() {
    requestAnimationFrame(drawScope);
    const dpr = sizeCanvas(scopecv), W = scopecv.width, H = scopecv.height;
    scx.clearRect(0, 0, W, H);
    scx.strokeStyle = "rgba(111,228,166,0.10)"; scx.lineWidth = 1 * dpr;
    scx.beginPath(); scx.moveTo(0, H / 2); scx.lineTo(W, H / 2); scx.stroke();
    if (!E.started) return;
    const buf = E.scopeBuffer; if (!buf) return;
    E.getTimeData(buf);
    let start = 0; for (let i = 1; i < buf.length / 2; i++) { if (buf[i - 1] < 0 && buf[i] >= 0) { start = i; break; } }
    const span = Math.floor(buf.length / 2);
    scx.lineWidth = 2 * dpr; scx.strokeStyle = "#6fe4a6"; scx.shadowColor = "rgba(111,228,166,0.7)"; scx.shadowBlur = 6 * dpr;
    scx.beginPath();
    for (let i = 0; i < span; i++) { const v = buf[start + i] || 0; const x = (i / span) * W; const y = H / 2 - v * (H * 0.42); i === 0 ? scx.moveTo(x, y) : scx.lineTo(x, y); }
    scx.stroke(); scx.shadowBlur = 0;
    if (E.getReduction) { const gr = E.getReduction(); $("compGR").textContent = `${gr.top.toFixed(1)} / ${gr.sub.toFixed(1)} / ${gr.out.toFixed(1)} dB`; }
  }
  drawEnv(); requestAnimationFrame(drawScope);
  window.addEventListener("resize", drawEnv);

  const hashPreset = WF.Presets.loadFromHash();
  if (hashPreset && hashPreset.name) {
    $("presetName").value = hashPreset.name;
    flash($("presetMsg"), "Loaded URL patch");
  }

  // reflect BPM readout after any URL patch load
  updateRateReadout();
})();
