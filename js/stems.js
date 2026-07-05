/* wubflipz — Stage 3 "Quick Split" (DSP stem separation, NO ML)
 * Honest, approximate, client-side. Two techniques:
 *   1. HPSS — median filtering of the magnitude spectrogram (Fitzgerald 2010):
 *      horizontal (time) median -> harmonic, vertical (frequency) median -> percussive.
 *   2. Mid/Side — (L-R) removes centre content (rough vocal remove), (L+R)/2 keeps it.
 * STFT/ISTFT done manually with WF.FFT; processed in time-chunks with yields + progress
 * so the main thread stays responsive and peak memory stays bounded on long files.
 */
(function () {
  "use strict";
  const WF = (window.WF = window.WF || {});
  const $ = (id) => document.getElementById(id);

  // ---- shared track registry (consumed by Stage 4 lanes) ----
  const Tracks = { list: [], onChange: [], _id: 0,
    add(name, buffer, kind) { const t = { id: ++this._id, name, buffer, kind: kind || "derived" }; this.list.push(t); this.emit(); return t; },
    clearDerived() { this.list = this.list.filter((t) => t.kind === "original"); this.emit(); },
    reset() { this.list = []; this.emit(); },
    emit() { this.onChange.forEach((cb) => { try { cb(this.list); } catch (e) {} }); },
  };
  WF.Tracks = Tracks;

  // ---- helpers ----
  function monoMix(audioBuffer) {
    const ch = audioBuffer.numberOfChannels, n = audioBuffer.length;
    const out = new Float32Array(n);
    for (let c = 0; c < ch; c++) { const d = audioBuffer.getChannelData(c); for (let i = 0; i < n; i++) out[i] += d[i]; }
    if (ch > 1) for (let i = 0; i < n; i++) out[i] /= ch;
    return out;
  }
  function makeBuffer(ctx, float32, sr) { const b = ctx.createBuffer(1, float32.length, sr); b.copyToChannel(float32, 0); return b; }
  function hann(n) { const w = new Float32Array(n); for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)); return w; }
  const sleep = () => new Promise((r) => setTimeout(r, 0));

  // median of a window into a scratch array (insertion sort, small windows)
  function medianInto(scratch, count) {
    for (let i = 1; i < count; i++) { const v = scratch[i]; let j = i - 1; while (j >= 0 && scratch[j] > v) { scratch[j + 1] = scratch[j]; j--; } scratch[j + 1] = v; }
    return scratch[count >> 1];
  }

  // ---- HPSS ----
  async function hpss(mono, sr, onProgress) {
    const FFT = WF.FFT.fft, IFFT = WF.FFT.ifft;
    const fftSize = 2048, hop = 512, half = fftSize / 2 + 1;
    const win = hann(fftSize);
    const N = mono.length;
    const padded = N + fftSize;
    const numFrames = Math.floor((padded - fftSize) / hop) + 1;
    const rF = 8, rT = 8; // median radii (window 17) for freq / time

    // Pass 1: magnitude spectrogram (only magnitudes stored -> bounded memory)
    const mag = new Float32Array(numFrames * half);
    const re = new Float64Array(fftSize), im = new Float64Array(fftSize);
    for (let f = 0; f < numFrames; f++) {
      const s0 = f * hop;
      for (let i = 0; i < fftSize; i++) { const s = s0 + i; re[i] = s < N ? mono[s] * win[i] : 0; im[i] = 0; }
      FFT(re, im);
      const off = f * half;
      for (let k = 0; k < half; k++) mag[off + k] = Math.hypot(re[k], im[k]);
      if ((f & 255) === 0) { onProgress && onProgress((f / numFrames) * 0.5); await sleep(); }
    }

    // Pass 2: masks (recompute complex per frame) + ISTFT overlap-add
    const outH = new Float32Array(padded), outP = new Float32Array(padded), wsum = new Float32Array(padded);
    const reH = new Float64Array(fftSize), imH = new Float64Array(fftSize);
    const reP = new Float64Array(fftSize), imP = new Float64Array(fftSize);
    const sf = new Float32Array(2 * rF + 1), st = new Float32Array(2 * rT + 1);
    const maskH = new Float32Array(half);
    for (let f = 0; f < numFrames; f++) {
      const s0 = f * hop, off = f * half;
      for (let i = 0; i < fftSize; i++) { const s = s0 + i; re[i] = s < N ? mono[s] * win[i] : 0; im[i] = 0; }
      FFT(re, im);
      for (let k = 0; k < half; k++) {
        // percussive estimate: median across frequency (this frame)
        let c = 0; for (let d = -rF; d <= rF; d++) { let kk = k + d; if (kk < 0) kk = -kk; if (kk >= half) kk = 2 * half - 2 - kk; sf[c++] = mag[off + kk]; }
        const P = medianInto(sf, c);
        // harmonic estimate: median across time (this bin)
        c = 0; for (let d = -rT; d <= rT; d++) { let ff = f + d; if (ff < 0) ff = 0; if (ff >= numFrames) ff = numFrames - 1; st[c++] = mag[ff * half + k]; }
        const H = medianInto(st, c);
        const hh = H * H, pp = P * P, den = hh + pp + 1e-12;
        maskH[k] = hh / den; // soft (Wiener) ratio mask; percussive mask = 1 - maskH
      }
      // apply masks to full complex spectrum (Hermitian symmetric)
      for (let j = 0; j < fftSize; j++) {
        const k = j <= fftSize / 2 ? j : fftSize - j;
        const mH = maskH[k];
        reH[j] = re[j] * mH; imH[j] = im[j] * mH;
        reP[j] = re[j] * (1 - mH); imP[j] = im[j] * (1 - mH);
      }
      IFFT(reH, imH); IFFT(reP, imP);
      for (let i = 0; i < fftSize; i++) {
        const s = s0 + i, w = win[i];
        outH[s] += reH[i] * w; outP[s] += reP[i] * w; wsum[s] += w * w;
      }
      if ((f & 127) === 0) { onProgress && onProgress(0.5 + (f / numFrames) * 0.5); await sleep(); }
    }
    // normalise overlap-add and trim
    const H = new Float32Array(N), Pc = new Float32Array(N);
    for (let i = 0; i < N; i++) { const w = wsum[i] > 1e-6 ? wsum[i] : 1; H[i] = outH[i] / w; Pc[i] = outP[i] / w; }
    return { harmonic: H, percussive: Pc };
  }

  // ---- Mid/Side (cheap, no FFT) ----
  function midSide(audioBuffer) {
    const n = audioBuffer.length;
    if (audioBuffer.numberOfChannels < 2) return null;
    const L = audioBuffer.getChannelData(0), R = audioBuffer.getChannelData(1);
    const removed = new Float32Array(n), only = new Float32Array(n);
    for (let i = 0; i < n; i++) { removed[i] = (L[i] - R[i]) * 0.5; only[i] = (L[i] + R[i]) * 0.5; }
    return { midRemoved: removed, midOnly: only };
  }

  // ---- orchestration ----
  async function runHPSS(audioBuffer, ctx, onProgress) {
    const mono = monoMix(audioBuffer);
    const { harmonic, percussive } = await hpss(mono, audioBuffer.sampleRate, onProgress);
    Tracks.add("Harmonic (HPSS)", makeBuffer(ctx, harmonic, audioBuffer.sampleRate));
    Tracks.add("Percussive (HPSS)", makeBuffer(ctx, percussive, audioBuffer.sampleRate));
  }
  function runMidSide(audioBuffer, ctx) {
    const ms = midSide(audioBuffer);
    if (!ms) return false;
    Tracks.add("Vocal-removed (mid−)", makeBuffer(ctx, ms.midRemoved, audioBuffer.sampleRate));
    Tracks.add("Vocal-isolate (mid+)", makeBuffer(ctx, ms.midOnly, audioBuffer.sampleRate));
    return true;
  }

  // ---- UI ----
  let busy = false;
  function setProg(p) { const w = $("splitProg"); w.style.display = p >= 0 ? "block" : "none"; if (p >= 0) $("splitBar").style.width = Math.round(p * 100) + "%"; }
  function status(msg) { $("splitStatus").textContent = msg; }

  function initUI() {
    // register the original as a track when a file loads
    if (WF.Player) WF.Player.onLoaded.push((buf) => { Tracks.reset(); Tracks.add("Original", buf, "original"); status(""); });

    const guard = () => { if (!WF.Player || !WF.Player.buffer) { status("Load a file first."); return false; } if (busy) return false; return true; };

    $("splitHP").addEventListener("click", async () => {
      if (!guard()) return;
      busy = true; status("Running HPSS… (approximate, this can take a while on long files)"); setProg(0);
      try { await runHPSS(WF.Player.buffer, WF.Player.ctx, setProg); status("HPSS done — harmonic + percussive added below."); }
      catch (e) { status("HPSS failed: " + e.message); }
      finally { busy = false; setProg(-1); }
    });
    $("splitMS").addEventListener("click", () => {
      if (!guard()) return;
      const ok = runMidSide(WF.Player.buffer, WF.Player.ctx);
      status(ok ? "Mid/Side done — vocal-removed + isolate added below." : "Mid/Side needs a STEREO file (this one is mono).");
    });
    $("splitPreviewStop").addEventListener("click", stopPreview);

    // stem list with tiny preview (full mixer is Stage 4)
    Tracks.onChange.push(renderList);
    renderList(Tracks.list);
  }

  let previewSrc = null, previewGain = null;
  function ensurePreviewGain(ctx) {
    if (!previewGain) {
      previewGain = ctx.createGain();
      previewGain.gain.value = 1;
      previewGain.connect(ctx.destination);
    }
    return previewGain;
  }
  function stopPreview() {
    if (previewSrc) { try { previewSrc.stop(0); } catch (e) {} previewSrc = null; }
  }
  function emergencyStop() {
    const ctx = WF.Player && WF.Player.ctx;
    if (ctx && previewGain) {
      const t = ctx.currentTime;
      previewGain.gain.cancelScheduledValues(t);
      previewGain.gain.setValueAtTime(previewGain.gain.value, t);
      previewGain.gain.linearRampToValueAtTime(0, t + 0.01);
    }
    const src = previewSrc; previewSrc = null;
    setTimeout(() => {
      try { src && src.stop(0); } catch (e) {}
      if (ctx && previewGain) previewGain.gain.setValueAtTime(1, ctx.currentTime);
    }, ctx ? 12 : 0);
  }
  function preview(buffer) {
    const ctx = WF.Player.ctx; if (!ctx) return;
    stopPreview();
    const s = ctx.createBufferSource(); s.buffer = buffer; s.connect(ensurePreviewGain(ctx)); s.onended = () => (previewSrc = null); s.start(); previewSrc = s;
  }
  function renderList(list) {
    const el = $("stemList"); if (!el) return;
    el.innerHTML = "";
    if (!list.length) { el.innerHTML = `<span class="muted">No tracks yet — load a file, then split.</span>`; return; }
    list.forEach((t) => {
      const row = document.createElement("div"); row.className = "stem-row";
      const nm = document.createElement("span"); nm.className = "stem-name"; nm.textContent = t.name;
      const pv = document.createElement("button"); pv.className = "tbtn"; pv.textContent = "▶ preview";
      pv.addEventListener("click", () => preview(t.buffer));
      row.appendChild(nm); row.appendChild(pv); el.appendChild(row);
    });
  }

  WF.Stems = { hpss, midSide, runHPSS, runMidSide, stopPreview, emergencyStop, Tracks };
  if ($("quickSplitBoard")) initUI();
})();
