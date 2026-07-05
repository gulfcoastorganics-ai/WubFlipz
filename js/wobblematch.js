/* wubflipz — Wobble Match from reference track
 * Heuristic bass-envelope analysis. Outputs an editable normal preset.
 */
(function () {
  "use strict";
  const WF = (window.WF = window.WF || {});
  const $ = (id) => document.getElementById(id);

  const DIVS = ["1/1", "1/2", "1/2.", "1/2T", "1/4", "1/4.", "1/4T", "1/8", "1/8.", "1/8T", "1/16", "1/16.", "1/16T"];

  function monoMix(buf) {
    const n = buf.length, ch = buf.numberOfChannels, out = new Float32Array(n);
    for (let c = 0; c < ch; c++) { const d = buf.getChannelData(c); for (let i = 0; i < n; i++) out[i] += d[i]; }
    if (ch > 1) for (let i = 0; i < n; i++) out[i] /= ch;
    return out;
  }

  async function bandpassBass(buf) {
    const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OC) return monoMix(buf);
    const offline = new OC(1, buf.length, buf.sampleRate);
    const src = offline.createBufferSource();
    const mono = offline.createBuffer(1, buf.length, buf.sampleRate);
    mono.copyToChannel(monoMix(buf), 0);
    const hp = offline.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 40; hp.Q.value = 0.707;
    const lp = offline.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 250; lp.Q.value = 0.707;
    src.buffer = mono; src.connect(hp).connect(lp).connect(offline.destination); src.start(0);
    const rendered = await offline.startRendering();
    return rendered.getChannelData(0).slice();
  }

  function envelopeRms(samples, sr, winMs) {
    const win = Math.max(32, Math.round(sr * (winMs || 0.01)));
    const hop = Math.max(16, Math.round(win / 2));
    const frames = Math.max(1, Math.floor((samples.length - win) / hop) + 1);
    const env = new Float32Array(frames);
    for (let f = 0; f < frames; f++) {
      let sum = 0, off = f * hop;
      for (let i = 0; i < win; i++) { const v = samples[off + i] || 0; sum += v * v; }
      env[f] = Math.sqrt(sum / win);
    }
    let max = 0; for (let i = 0; i < env.length; i++) if (env[i] > max) max = env[i];
    if (max > 1e-9) for (let i = 0; i < env.length; i++) env[i] /= max;
    return { env, rate: sr / hop };
  }

  function autocorrRate(env, rate, bpm) {
    const minHz = Math.max(0.25, bpm / 60 / 4);
    const maxHz = Math.min(32, bpm / 60 * 8);
    const minLag = Math.max(1, Math.floor(rate / maxHz));
    const maxLag = Math.min(env.length - 2, Math.ceil(rate / minHz));
    let bestLag = minLag, best = -Infinity;
    const scores = [];
    for (let lag = minLag; lag <= maxLag; lag++) {
      let s = 0, e0 = 0, e1 = 0;
      for (let i = 0; i + lag < env.length; i++) { const a = env[i], b = env[i + lag]; s += a * b; e0 += a * a; e1 += b * b; }
      const score = s / (Math.sqrt(e0 * e1) + 1e-12);
      scores[lag] = score;
      if (score > best) { best = score; bestLag = lag; }
    }
    for (let lag = minLag + 1; lag < maxLag; lag++) {
      if (scores[lag] > best * 0.82 && scores[lag] >= scores[lag - 1] && scores[lag] >= scores[lag + 1]) {
        bestLag = lag;
        best = scores[lag];
        break;
      }
    }
    return { hz: rate / bestLag, lag: bestLag, score: best };
  }

  function divBeats(div) {
    return (WF.WOBBLE_DIVS && WF.WOBBLE_DIVS[div]) || ({ "1/1": 4, "1/2": 2, "1/2.": 3, "1/2T": 8 / 3, "1/4": 1, "1/4.": 1.5, "1/4T": 2 / 3, "1/8": 0.5, "1/8.": 0.75, "1/8T": 1 / 3, "1/16": 0.25, "1/16.": 0.375, "1/16T": 1 / 6 })[div];
  }
  function snapDivision(hz, bpm) {
    let best = "1/8", bestD = Infinity;
    for (const d of DIVS) {
      const target = (bpm / 60) / divBeats(d);
      const dist = Math.abs(Math.log2(hz / target));
      if (dist < bestD) { bestD = dist; best = d; }
    }
    return best;
  }

  function percentile(sorted, p) {
    const i = Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p)));
    return sorted[i] || 0;
  }
  function depthAndShape(env) {
    const vals = Array.from(env).sort((a, b) => a - b);
    const lo = percentile(vals, 0.10), hi = percentile(vals, 0.90);
    const dyn = Math.max(0, hi - lo);
    const depth = Math.max(0.05, Math.min(1, dyn * 1.15));
    const nearLow = lo + dyn * 0.18, nearHigh = hi - dyn * 0.18;
    let extremes = 0;
    for (const v of env) if (v <= nearLow || v >= nearHigh) extremes++;
    const duty = extremes / Math.max(1, env.length);
    const shape = duty > 0.75 ? "square" : duty < 0.38 ? "triangle" : "sine";
    return { depth, shape, duty, lo, hi };
  }

  function detectedBpm() {
    const det = $("detBpm");
    const v = det ? parseFloat(det.value) : NaN;
    if (isFinite(v) && v >= 40) return v;
    if (WF.Grid && WF.Grid.bpm) return WF.Grid.bpm;
    return WF.state && WF.state.bpm ? WF.state.bpm : 140;
  }

  function analyzeEnvelope(env, rate, bpm) {
    const ac = autocorrRate(env, rate, bpm);
    const div = snapDivision(ac.hz, bpm);
    const ds = depthAndShape(env);
    return { bpm, hz: ac.hz, score: ac.score, division: div, depth: ds.depth, shape: ds.shape, duty: ds.duty };
  }

  async function matchBuffer(buf, bpm) {
    const bass = await bandpassBass(buf);
    const { env, rate } = envelopeRms(bass, buf.sampleRate, 0.012);
    return analyzeEnvelope(env, rate, bpm || detectedBpm());
  }

  function resultPreset(r) {
    const current = WF.Presets && WF.Presets.capture ? WF.Presets.capture("Matched Wobble Estimate") : { app: "wubflipz", version: 1, params: Object.assign({}, WF.state) };
    current.name = "Matched Wobble Estimate";
    current.params = Object.assign({}, current.params, {
      bpm: Math.round(r.bpm),
      wobbleOn: true,
      wobbleDiv: r.division,
      wobbleDepth: +r.depth.toFixed(3),
      wobbleWave: r.shape,
      growlAmount: Math.max(0.08, Math.min(0.75, r.depth * 0.55)),
      growlRate: Math.max(4, Math.min(48, r.hz * (r.shape === "square" ? 3 : 2))),
      growlWave: r.shape === "square" ? "square" : "triangle",
    });
    return current;
  }

  async function runMatch() {
    const out = $("matchStatus");
    if (!WF.Player || !WF.Player.buffer) { if (out) out.textContent = "Load a track first. This uses the current Sample / Quick Split buffer."; return null; }
    if (out) out.textContent = "Estimating wobble from bass envelope…";
    try {
      const r = await matchBuffer(WF.Player.buffer, detectedBpm());
      const preset = resultPreset(r);
      WF.Presets.apply(preset);
      if ($("presetName")) $("presetName").value = preset.name;
      if (out) out.textContent = `Estimated starting point: ${r.division}, depth ${Math.round(r.depth * 100)}%, ${r.shape}-ish LFO. Edit any control by hand.`;
      return r;
    } catch (e) {
      if (out) out.textContent = "Wobble match failed: " + e.message;
      return null;
    }
  }

  function syntheticEnvelope({ bpm = 140, division = "1/8.", shape = "square", depth = 0.7, seconds = 8, rate = 400 } = {}) {
    const n = Math.floor(seconds * rate);
    const hz = (bpm / 60) / divBeats(division);
    const env = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const ph = (i / rate * hz) % 1;
      let lfo;
      if (shape === "square") lfo = ph < 0.5 ? 1 : 0;
      else if (shape === "triangle") lfo = ph < 0.5 ? ph * 2 : 2 - ph * 2;
      else lfo = 0.5 - 0.5 * Math.cos(2 * Math.PI * ph);
      env[i] = 1 - depth + depth * lfo;
    }
    return { env, rate };
  }

  WF.WobbleMatch = { matchBuffer, analyzeEnvelope, envelopeRms, autocorrRate, snapDivision, depthAndShape, syntheticEnvelope };
  if ($("matchWobbleBtn")) $("matchWobbleBtn").addEventListener("click", runMatch);
})();
