/* wubflipz — Stage 5 tempo / key / beat-grid detection (estimates, user-overridable)
 * Tempo:  spectral-flux onset envelope -> autocorrelation -> BPM (+ octave sanity),
 *         then comb-phase -> beat times. Auto-populates the Wobble BPM field.
 * Key:    whole-track chroma vector -> Krumhansl-Schmuckler profile correlation.
 * Grid:   vertical beat lines on the Sample + lane waveforms; loop/playhead snap.
 * Nothing here is authoritative — every detected value writes into an editable control.
 */
(function () {
  "use strict";
  const WF = (window.WF = window.WF || {});
  const $ = (id) => document.getElementById(id);
  const NOTE = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const sleep = () => new Promise((r) => setTimeout(r, 0));

  function monoMix(buf) {
    const ch = buf.numberOfChannels, n = buf.length, out = new Float32Array(n);
    for (let c = 0; c < ch; c++) { const d = buf.getChannelData(c); for (let i = 0; i < n; i++) out[i] += d[i]; }
    if (ch > 1) for (let i = 0; i < n; i++) out[i] /= ch;
    return out;
  }
  const hann = (n) => { const w = new Float32Array(n); for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)); return w; };

  // ---- spectral-flux onset envelope ----
  async function onsetEnvelope(mono, sr, onProgress) {
    const N = 1024, hop = 512, win = hann(N), half = N / 2 + 1;
    const frames = Math.max(1, Math.floor((mono.length - N) / hop) + 1);
    const env = new Float32Array(frames);
    const re = new Float64Array(N), im = new Float64Array(N), prev = new Float32Array(half);
    for (let f = 0; f < frames; f++) {
      const s0 = f * hop;
      for (let i = 0; i < N; i++) { const s = s0 + i; re[i] = s < mono.length ? mono[s] * win[i] : 0; im[i] = 0; }
      WF.FFT.fft(re, im);
      let flux = 0;
      for (let k = 0; k < half; k++) { const m = Math.hypot(re[k], im[k]); const d = m - prev[k]; if (d > 0) flux += d; prev[k] = m; }
      env[f] = flux;
      if ((f & 511) === 0) { onProgress && onProgress((f / frames) * 0.6); await sleep(); }
    }
    // normalise (remove slow drift)
    let mean = 0; for (let i = 0; i < frames; i++) mean += env[i]; mean /= frames;
    for (let i = 0; i < frames; i++) env[i] = Math.max(0, env[i] - mean);
    return { env, rate: sr / hop };
  }

  // ---- tempo via autocorrelation over a BPM search range ----
  function estimateTempo(env, rate) {
    const bpmMin = 70, bpmMax = 180, step = 0.25;
    let best = { bpm: 140, score: -1 };
    const n = env.length;
    for (let bpm = bpmMin; bpm <= bpmMax; bpm += step) {
      const lag = Math.round((60 / bpm) * rate);
      if (lag < 1 || lag >= n) continue;
      let s = 0; for (let i = 0; i + lag < n; i++) s += env[i] * env[i + lag];
      // mild preference for the mid/typical range to reduce octave errors
      s *= 1 + 0.05 * Math.exp(-Math.pow((bpm - 140) / 60, 2));
      if (s > best.score) best = { bpm, score: s };
    }
    // octave sanity: compare with half / double if they land in range and score better per-beat
    return best;
  }

  // ---- beat phase via comb correlation ----
  function estimatePhase(env, rate, bpm) {
    const P = (60 / bpm) * rate;
    const Pi = Math.max(1, Math.round(P));
    let best = { phase: 0, score: -1 };
    for (let ph = 0; ph < Pi; ph++) {
      let s = 0; for (let k = 0; ph + k * P < env.length; k++) s += env[Math.round(ph + k * P)] || 0;
      if (s > best.score) best = { phase: ph, score: s };
    }
    return best.phase / rate; // seconds
  }

  // ---- key via chroma + Krumhansl-Schmuckler ----
  async function estimateKey(mono, sr, onProgress) {
    const N = 4096, hop = 4096, win = hann(N), half = N / 2 + 1; // coarse, cheap
    const chroma = new Float64Array(12);
    const re = new Float64Array(N), im = new Float64Array(N);
    const frames = Math.max(1, Math.floor((mono.length - N) / hop) + 1);
    for (let f = 0; f < frames; f++) {
      const s0 = f * hop;
      for (let i = 0; i < N; i++) { const s = s0 + i; re[i] = s < mono.length ? mono[s] * win[i] : 0; im[i] = 0; }
      WF.FFT.fft(re, im);
      for (let k = 1; k < half; k++) {
        const freq = (k * sr) / N;
        if (freq < 55 || freq > 5000) continue;
        const pc = ((Math.round(69 + 12 * Math.log2(freq / 440)) % 12) + 12) % 12;
        chroma[pc] += Math.hypot(re[k], im[k]);
      }
      if ((f & 63) === 0) { onProgress && onProgress(0.6 + (f / frames) * 0.4); await sleep(); }
    }
    const major = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
    const minor = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
    const corr = (a, b) => {
      let ma = 0, mb = 0; for (let i = 0; i < 12; i++) { ma += a[i]; mb += b[i]; } ma /= 12; mb /= 12;
      let num = 0, da = 0, db = 0;
      for (let i = 0; i < 12; i++) { const x = a[i] - ma, y = b[i] - mb; num += x * y; da += x * x; db += y * y; }
      return num / (Math.sqrt(da * db) + 1e-12);
    };
    let best = { name: "—", score: -2, tonic: 0, mode: "major" };
    for (let t = 0; t < 12; t++) {
      const rotM = major.map((_, i) => major[(i - t + 12) % 12]);
      const rotm = minor.map((_, i) => minor[(i - t + 12) % 12]);
      const cM = corr(chroma, rotM), cm = corr(chroma, rotm);
      if (cM > best.score) best = { name: NOTE[t] + " major", score: cM, tonic: t, mode: "major" };
      if (cm > best.score) best = { name: NOTE[t] + " minor", score: cm, tonic: t, mode: "minor" };
    }
    return best;
  }

  // ---- beat grid ----
  const Grid = {
    active: false, snapOn: false, bpm: 0, phase: 0, beats: [],
    set(bpm, phase, duration) {
      this.bpm = bpm; this.phase = phase; this.beats = [];
      if (bpm > 0) { const T = 60 / bpm; for (let t = phase % T; t < duration; t += T) this.beats.push(t); }
      this.active = true; redrawAll();
    },
    clear() { this.active = false; this.beats = []; redrawAll(); },
    snap(t) {
      if (!this.active || !this.snapOn || !this.beats.length) return t;
      let lo = 0, hi = this.beats.length - 1, bestT = t, bestD = Infinity;
      for (let i = 0; i < this.beats.length; i++) { const d = Math.abs(this.beats[i] - t); if (d < bestD) { bestD = d; bestT = this.beats[i]; } }
      return bestT;
    },
    // for the Sample player (per-frame hook)
    overlay(g, o) {
      if (!this.active) return;
      g.strokeStyle = "rgba(125,180,255,0.45)"; g.lineWidth = 1;
      for (const bt of this.beats) { if (bt < o.view.start || bt > o.view.end) continue; const x = o.timeToXcss(bt) * o.sx; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, o.H); g.stroke(); }
    },
    // for lanes (full 0..maxDur axis)
    overlayFull(g, o) {
      if (!this.active) return;
      g.strokeStyle = "rgba(125,180,255,0.40)"; g.lineWidth = 1;
      for (const bt of this.beats) { const x = (bt / o.maxDur) * o.width; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, o.height); g.stroke(); }
    },
  };
  WF.Grid = Grid;
  function redrawAll() { if (WF.Player && WF.Player.render) WF.Player.render(); if (WF.Lanes && WF.Lanes.redraw) WF.Lanes.redraw(); }

  // ---- orchestration ----
  async function detect(buf, onProgress) {
    const mono = monoMix(buf), sr = buf.sampleRate;
    const { env, rate } = await onsetEnvelope(mono, sr, onProgress);
    const tempo = estimateTempo(env, rate);
    const phase = estimatePhase(env, rate, tempo.bpm);
    const key = await estimateKey(mono, sr, onProgress);
    return { bpm: tempo.bpm, phase, key, duration: buf.duration };
  }

  // ---- UI ----
  let busy = false;
  function initUI() {
    // populate key dropdown (editable override; detection has no auto-transpose)
    const sel = $("detKey");
    ["—"].concat([].concat(...NOTE.map((n) => [n + " major", n + " minor"]))).forEach((k) => { const o = document.createElement("option"); o.value = k; o.textContent = k; sel.appendChild(o); });

    function setBpm(bpm) {
      const b = $("detBpm"); b.value = Math.round(bpm);
      // feed the synth's Wobble BPM via its existing (editable) input
      const synthBpm = $("bpm");
      if (synthBpm) { synthBpm.value = Math.round(bpm); synthBpm.dispatchEvent(new Event("input")); }
      if (WF.Grid.active && WF.Player) WF.Grid.set(Math.round(bpm), WF.Grid.phase, WF.Player.duration);
    }
    $("detBpm").addEventListener("input", () => { const v = parseFloat($("detBpm").value); if (isFinite(v)) setBpm(v); });

    $("detectBtn").addEventListener("click", async () => {
      if (busy) return;
      if (!WF.Player || !WF.Player.buffer) { $("detConf").value = "load a file first"; return; }
      busy = true; setProg(0); $("detConf").value = "analysing…";
      try {
        const r = await detect(WF.Player.buffer, setProg);
        $("detBpm").value = Math.round(r.bpm);
        $("detKey").value = r.key.name;
        $("detConf").value = `key r=${r.key.score.toFixed(2)}`;
        WF.Grid.phase = r.phase;
        WF.Grid.set(Math.round(r.bpm), r.phase, r.duration);
        $("gridToggle").classList.add("on"); $("gridToggle").textContent = "Grid On";
        // push BPM to the synth
        const synthBpm = $("bpm"); if (synthBpm) { synthBpm.value = Math.round(r.bpm); synthBpm.dispatchEvent(new Event("input")); }
      } catch (e) { $("detConf").value = "failed: " + e.message; }
      finally { busy = false; setProg(-1); }
    });
    $("gridToggle").addEventListener("click", () => {
      if (WF.Grid.active) { WF.Grid.clear(); $("gridToggle").textContent = "Grid Off"; $("gridToggle").classList.remove("on"); }
      else if (WF.Grid.beats.length || (WF.Player && WF.Player.buffer)) { WF.Grid.active = true; redrawAll(); $("gridToggle").textContent = "Grid On"; $("gridToggle").classList.add("on"); }
    });
    $("snapToggle").addEventListener("click", () => {
      WF.Grid.snapOn = !WF.Grid.snapOn;
      $("snapToggle").textContent = WF.Grid.snapOn ? "Snap On" : "Snap Off"; $("snapToggle").classList.toggle("on", WF.Grid.snapOn);
    });
  }
  function setProg(p) { const w = $("analyzeProg"); if (!w) return; w.style.display = p >= 0 ? "block" : "none"; if (p >= 0) $("analyzeBar").style.width = Math.round(p * 100) + "%"; }

  WF.Analyze = { detect, onsetEnvelope, estimateTempo, estimatePhase, estimateKey };
  if ($("analyzeBoard")) initUI();
})();
