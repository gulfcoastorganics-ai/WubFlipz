/* wubflipz — 8-pad step sequencer / drum pad
 * Own AudioContext, own drum bus + limiter, fixed 16-step binary loop.
 */
(function () {
  "use strict";
  const WF = (window.WF = window.WF || {});
  const $ = (id) => document.getElementById(id);
  const PAD_NAMES = ["Kick", "Snare", "Clap", "Closed Hat", "Open Hat", "Low Tom", "Rim", "Crash"];
  const STEPS = 16, TICK_MS = 25, LOOKAHEAD = 0.10;

  function defaultPattern() {
    const p = PAD_NAMES.map(() => Array(STEPS).fill(false));
    [0, 8].forEach((s) => (p[0][s] = true));
    [4, 12].forEach((s) => (p[1][s] = true));
    for (let s = 0; s < STEPS; s += 2) p[3][s] = true;
    return p;
  }

  const S = {
    ctx: null, master: null, limiter: null, noise: null, analyser: null,
    playing: false, timer: 0, currentStep: 0, nextStep: 0, nextTime: 0,
    bpm: 140, sync: true,
    pattern: defaultPattern(),
    pads: PAD_NAMES.map((name) => ({ name, level: 0.85, pitch: 0, sample: null, sampleName: "" })),
    voices: new Set(),
    _scheduledLog: [],
    _stepEvents: [], _visualStep: -1,
  };

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function activeBpm() { return S.sync && WF.state ? WF.state.bpm : S.bpm; }
  function stepDur(bpm) { return 60 / clamp(bpm || 140, 40, 300) / 4; }

  function ensureAudio() {
    if (S.ctx) { if (S.ctx.state === "suspended") S.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    S.ctx = new AC({ latencyHint: "interactive" });
    S.master = S.ctx.createGain(); S.master.gain.value = 1;
    S.limiter = S.ctx.createDynamicsCompressor();
    S.limiter.threshold.value = -6; S.limiter.knee.value = 6; S.limiter.ratio.value = 8;
    S.limiter.attack.value = 0.002; S.limiter.release.value = 0.08;
    S.master.connect(S.limiter); S.limiter.connect(S.ctx.destination);
    // meter tap (fix-s1): drum playback is measured by the meter bridge
    S.analyser = S.ctx.createAnalyser(); S.analyser.fftSize = 2048;
    S.limiter.connect(S.analyser);
    makeNoise();
  }

  function makeNoise() {
    const n = S.ctx.sampleRate * 2;
    S.noise = S.ctx.createBuffer(1, n, S.ctx.sampleRate);
    const d = S.noise.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }

  function trackVoice(nodes, endTime) {
    const v = { nodes };
    S.voices.add(v);
    setTimeout(() => S.voices.delete(v), Math.max(20, (endTime - S.ctx.currentTime + 0.05) * 1000));
    return v;
  }
  function stopVoice(v, when) {
    v.nodes.forEach((n) => { if (n.gain) { try { n.gain.cancelScheduledValues(when); n.gain.setValueAtTime(n.gain.value, when); n.gain.linearRampToValueAtTime(0, when + 0.01); } catch (e) {} } });
    setTimeout(() => v.nodes.forEach((n) => { try { n.stop && n.stop(0); } catch (e) {} }), 12);
  }

  function envGain(level, t, a, d) {
    const g = S.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(level, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    g.connect(S.master);
    return g;
  }
  function noiseSource(t, dur) {
    const s = S.ctx.createBufferSource(); s.buffer = S.noise; s.loop = true; s.start(t); s.stop(t + dur); return s;
  }
  function osc(type, freq, t, dur) {
    const o = S.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t); o.start(t); o.stop(t + dur); return o;
  }
  function filt(type, freq, q) {
    const f = S.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 0.7; return f;
  }

  function playSample(pad, t) {
    const src = S.ctx.createBufferSource();
    src.buffer = pad.sample;
    src.playbackRate.value = Math.pow(2, pad.pitch / 12);
    const g = envGain(pad.level, t, 0.001, Math.min(2, pad.sample.duration));
    src.connect(g); src.start(t);
    const end = t + pad.sample.duration / src.playbackRate.value;
    try { src.stop(end); } catch (e) {}
    trackVoice([src, g], end);
  }

  function playSynth(i, t) {
    const p = S.pads[i], level = p.level, pitch = Math.pow(2, p.pitch / 12);
    if (p.sample) { playSample(p, t); return; }
    const nodes = [];
    const add = (n) => { nodes.push(n); return n; };
    if (i === 0) {
      const o = add(osc("sine", 150 * pitch, t, 0.45)), g = add(envGain(level, t, 0.001, 0.42));
      o.frequency.exponentialRampToValueAtTime(50 * pitch, t + 0.10); o.connect(g);
    } else if (i === 1) {
      const n = add(noiseSource(t, 0.22)), hp = add(filt("highpass", 900, 0.8)), g = add(envGain(level * 0.8, t, 0.001, 0.18));
      const tone = add(osc("triangle", 190 * pitch, t, 0.16)), tg = add(envGain(level * 0.25, t, 0.001, 0.12));
      n.connect(hp).connect(g); tone.connect(tg);
    } else if (i === 2) {
      [0, 0.018, 0.038].forEach((off, k) => {
        const n = add(noiseSource(t + off, 0.12)), bp = add(filt("bandpass", 1800 + k * 250, 1.2)), g = add(envGain(level * (0.55 - k * 0.08), t + off, 0.001, 0.09));
        n.connect(bp).connect(g);
      });
    } else if (i === 3 || i === 4) {
      const dur = i === 3 ? 0.07 : 0.42;
      const n = add(noiseSource(t, dur)), hp = add(filt("highpass", 6500 * pitch, 0.6)), g = add(envGain(level * (i === 3 ? 0.45 : 0.38), t, 0.001, dur));
      n.connect(hp).connect(g);
    } else if (i === 5) {
      const o = add(osc("sine", 115 * pitch, t, 0.42)), g = add(envGain(level * 0.8, t, 0.002, 0.35));
      o.frequency.exponentialRampToValueAtTime(70 * pitch, t + 0.18); o.connect(g);
    } else if (i === 6) {
      const n = add(noiseSource(t, 0.045)), bp = add(filt("bandpass", 3200 * pitch, 5)), g = add(envGain(level * 0.55, t, 0.001, 0.035));
      n.connect(bp).connect(g);
    } else {
      const n = add(noiseSource(t, 1.2)), hp = add(filt("highpass", 4500 * pitch, 0.5)), g = add(envGain(level * 0.35, t, 0.003, 1.0));
      n.connect(hp).connect(g);
    }
    trackVoice(nodes, t + 1.4);
  }

  function scheduleStep(step, time) {
    S.currentStep = step;
    S._scheduledLog.push({ step, time });
    S._stepEvents.push({ step, time });
    for (let p = 0; p < S.pattern.length; p++) if (S.pattern[p][step]) playSynth(p, time);
  }
  function advance() {
    S.nextTime += stepDur(activeBpm());
    S.nextStep = (S.nextStep + 1) % STEPS;
  }
  function schedulerTick() {
    const now = S.ctx.currentTime;
    while (S.nextTime < now + LOOKAHEAD) { scheduleStep(S.nextStep, S.nextTime); advance(); }
  }
  function play() {
    ensureAudio(); if (S.playing) return;
    S.master.gain.cancelScheduledValues(S.ctx.currentTime); S.master.gain.setValueAtTime(1, S.ctx.currentTime);
    S.playing = true; S.nextStep = S.currentStep || 0; S.nextTime = S.ctx.currentTime + 0.05; S._scheduledLog = []; S._stepEvents = [];
    S.timer = setInterval(schedulerTick, TICK_MS); schedulerTick(); updateButtons();
  }
  function pause() { if (!S.playing) return; clearInterval(S.timer); S.timer = 0; S.playing = false; updateButtons(); }
  function stop() {
    clearInterval(S.timer); S.timer = 0; S.playing = false; S.currentStep = 0; S.nextStep = 0; S._stepEvents = []; S._visualStep = -1; stopActiveVoices(); updateButtons(); paintPlayhead(-1);
  }
  function stopActiveVoices() {
    if (!S.ctx) return;
    const t = S.ctx.currentTime;
    for (const v of [...S.voices]) { stopVoice(v, t); S.voices.delete(v); }
  }
  function emergencyStop() {
    if (!S.ctx) { S.playing = false; clearInterval(S.timer); S.timer = 0; S._stepEvents = []; S._visualStep = -1; updateButtons(); paintPlayhead(-1); return; }
    clearInterval(S.timer); S.timer = 0; S.playing = false; S.currentStep = 0; S.nextStep = 0; S._stepEvents = []; S._visualStep = -1;
    const t = S.ctx.currentTime;
    S.master.gain.cancelScheduledValues(t); S.master.gain.setValueAtTime(S.master.gain.value, t); S.master.gain.linearRampToValueAtTime(0, t + 0.01);
    for (const v of [...S.voices]) { stopVoice(v, t); S.voices.delete(v); }
    setTimeout(() => { if (S.master) S.master.gain.setValueAtTime(1, S.ctx.currentTime); updateButtons(); paintPlayhead(-1); }, 12);
  }

  function setSync(on) {
    S.sync = !!on;
    const b = $("seqSync"), input = $("seqBpm");
    if (b) { b.textContent = S.sync ? "Sync" : "Independent"; b.classList.toggle("on", S.sync); b.setAttribute("aria-pressed", S.sync ? "true" : "false"); }
    if (input) input.value = Math.round(activeBpm());
  }
  function setBpm(v, writeShared) {
    v = parseFloat(v);
    // Empty/garbage input must never reach shared state: NaN here wedged
    // WF.state.bpm and the wobble-rate math until a valid BPM was retyped
    // (AUDIT_REPORT_2026-07-05 finding #3; fix-s1). Keep the last good BPM.
    if (!isFinite(v)) return;
    v = clamp(v, 40, 300);
    if (S.sync) {
      if (WF.state) WF.state.bpm = v;
      const synth = $("bpm");
      if (synth && writeShared) { synth.value = Math.round(v); synth.dispatchEvent(new Event("input")); }
    } else S.bpm = v;
    const input = $("seqBpm"); if (input) input.value = Math.round(activeBpm());
  }

  function buildGrid() {
    const g = $("seqGrid"); if (!g) return;
    g.innerHTML = `<div class="seq-stephead"></div>` + Array.from({ length: STEPS }, (_, i) => `<div class="seq-stephead">${i + 1}</div>`).join("");
    S.pads.forEach((pad, r) => {
      const label = document.createElement("div"); label.className = "seq-label"; label.textContent = pad.name; g.appendChild(label);
      for (let c = 0; c < STEPS; c++) {
        const cell = document.createElement("button"); cell.type = "button"; cell.className = "seq-cell"; cell.dataset.row = r; cell.dataset.step = c; cell.setAttribute("aria-label", `${pad.name} step ${c + 1}`);
        cell.addEventListener("click", () => {
          S.pattern[r][c] = !S.pattern[r][c]; cell.classList.toggle("on", S.pattern[r][c]);
          window.dispatchEvent(new CustomEvent("wf:edit")); // grid edits reach history/autosave (fix-s1)
        });
        g.appendChild(cell);
      }
    });
    refreshGrid();
  }
  function buildPads() {
    const el = $("seqPads"); if (!el) return;
    el.innerHTML = "";
    S.pads.forEach((pad, i) => {
      const row = document.createElement("div"); row.className = "seq-pad";
      row.innerHTML = `<div class="seq-pad-head"><span>${pad.name}</span><button class="seq-pad-trigger" type="button">Hit</button></div>
        <div class="seq-pad-ctls">
          <label class="fld"><span>Level</span><input class="seq-level" type="range" min="0" max="1" step="0.01" value="${pad.level}"></label>
          <label class="fld"><span>Pitch</span><input class="seq-pitch" type="range" min="-12" max="12" step="1" value="${pad.pitch}"></label>
        </div>
        <div class="seq-sample"><label>Upload<input class="seq-file" type="file" accept="audio/*" hidden></label><span class="seq-sample-name">${pad.sampleName || "synth"}</span></div>`;
      row.querySelector(".seq-pad-trigger").addEventListener("click", () => { ensureAudio(); playSynth(i, S.ctx.currentTime + 0.005); });
      row.querySelector(".seq-level").addEventListener("input", (e) => { pad.level = +e.target.value; });
      row.querySelector(".seq-pitch").addEventListener("input", (e) => { pad.pitch = +e.target.value; });
      row.querySelector(".seq-file").addEventListener("change", async (e) => {
        const f = e.target.files[0]; if (!f) return;
        ensureAudio();
        try { pad.sample = await S.ctx.decodeAudioData(await f.arrayBuffer()); pad.sampleName = f.name; row.querySelector(".seq-sample-name").textContent = f.name; }
        catch (err) { row.querySelector(".seq-sample-name").textContent = "decode failed"; }
        e.target.value = "";
      });
      el.appendChild(row);
    });
  }
  function paintPlayhead(step) {
    document.querySelectorAll(".seq-cell.playing").forEach((c) => c.classList.remove("playing"));
    if (step >= 0) document.querySelectorAll(`.seq-cell[data-step="${step}"]`).forEach((c) => c.classList.add("playing"));
    const r = $("seqReadout"); if (r) r.textContent = `step ${step >= 0 ? step + 1 : 1} / ${STEPS}`;
  }
  function updateVisualStep() {
    if (!S.playing || !S.ctx) {
      if (S._visualStep !== -1) { S._visualStep = -1; paintPlayhead(-1); }
      return;
    }
    let due = null;
    while (S._stepEvents.length && S._stepEvents[0].time <= S.ctx.currentTime) due = S._stepEvents.shift();
    if (due && due.step !== S._visualStep) {
      S._visualStep = due.step;
      paintPlayhead(due.step);
    }
  }
  function refreshGrid() {
    document.querySelectorAll(".seq-cell").forEach((c) => c.classList.toggle("on", !!S.pattern[+c.dataset.row][+c.dataset.step]));
  }
  function updateButtons() {
    const b = $("seqPlay"); if (b) { b.textContent = S.playing ? "Pause" : "Play"; b.classList.toggle("on", S.playing); }
  }

  function capture() {
    return {
      sync: S.sync, bpm: activeBpm(),
      pattern: S.pattern.map((r) => r.slice()),
      pads: S.pads.map((p) => ({ level: p.level, pitch: p.pitch, sampleName: p.sampleName || "" })),
    };
  }
  function apply(data) {
    if (!data) return;
    if (typeof data.sync === "boolean") S.sync = data.sync;
    if (isFinite(data.bpm)) {
      if (S.sync && WF.state) WF.state.bpm = clamp(data.bpm, 40, 300);
      else S.bpm = clamp(data.bpm, 40, 300);
    }
    if (Array.isArray(data.pattern)) data.pattern.slice(0, 8).forEach((row, r) => { if (Array.isArray(row)) row.slice(0, STEPS).forEach((v, c) => (S.pattern[r][c] = !!v)); });
    if (Array.isArray(data.pads)) data.pads.slice(0, 8).forEach((p, i) => { if (isFinite(p.level)) S.pads[i].level = clamp(p.level, 0, 1); if (isFinite(p.pitch)) S.pads[i].pitch = clamp(p.pitch, -12, 12); S.pads[i].sampleName = p.sampleName || ""; });
    setSync(S.sync); refreshGrid(); buildPads();
  }

  function initUI() {
    buildGrid(); buildPads(); setSync(S.sync);
    $("seqPlay").addEventListener("click", () => S.playing ? pause() : play());
    $("seqStop").addEventListener("click", stop);
    $("seqSync").addEventListener("click", () => { setSync(!S.sync); window.dispatchEvent(new CustomEvent("wf:edit")); });
    $("seqBpm").addEventListener("input", (e) => setBpm(e.target.value, true));
    const synth = $("bpm");
    if (synth) synth.addEventListener("input", () => { if (S.sync) setBpm(synth.value, false); });
    if (WF.Viz) WF.Viz.register("sequencer-step", updateVisualStep);
  }

  function testSchedule(bpm, loops) {
    let t = 0, step = 0; const out = [], dur = stepDur(bpm), count = STEPS * (loops || 1);
    for (let i = 0; i < count; i++) { out.push({ step, time: t }); t += dur; step = (step + 1) % STEPS; }
    return out;
  }

  WF.Sequencer = Object.assign(S, { ensureAudio, play, pause, stop, emergencyStop, capture, apply, activeBpm, testSchedule, updateVisualStep, _constants: { STEPS, TICK_MS, LOOKAHEAD } });
  if ($("seqBoard")) initUI();
})();
