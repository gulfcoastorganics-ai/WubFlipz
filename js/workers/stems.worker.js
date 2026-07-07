/* wubflipz — Quick Split HPSS worker
 * Runs the same HPSS math as the old main-thread stems.js, off the main thread.
 * Receives the mono mixdown as a transferable ArrayBuffer, posts progress, and
 * transfers the harmonic/percussive result buffers back (no structured clone).
 */
"use strict";
importScripts("../fft.js");

function hann(n) {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
  return w;
}

function medianInto(scratch, count) {
  for (let i = 1; i < count; i++) {
    const v = scratch[i]; let j = i - 1;
    while (j >= 0 && scratch[j] > v) { scratch[j + 1] = scratch[j]; j--; }
    scratch[j + 1] = v;
  }
  return scratch[count >> 1];
}

function hpss(mono, sr, fftSize, hop, rF, rT, onProgress) {
  const FFT = WF.FFT.fft, IFFT = WF.FFT.ifft;
  const half = fftSize / 2 + 1;
  const win = hann(fftSize);
  const N = mono.length;
  const padded = N + fftSize;
  const numFrames = Math.floor((padded - fftSize) / hop) + 1;

  const mag = new Float32Array(numFrames * half);
  const re = new Float64Array(fftSize), im = new Float64Array(fftSize);
  for (let f = 0; f < numFrames; f++) {
    const s0 = f * hop;
    for (let i = 0; i < fftSize; i++) { const s = s0 + i; re[i] = s < N ? mono[s] * win[i] : 0; im[i] = 0; }
    FFT(re, im);
    const off = f * half;
    for (let k = 0; k < half; k++) mag[off + k] = Math.hypot(re[k], im[k]);
    if ((f & 255) === 0) onProgress((f / numFrames) * 0.5);
  }

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
      let c = 0; for (let d = -rF; d <= rF; d++) { let kk = k + d; if (kk < 0) kk = -kk; if (kk >= half) kk = 2 * half - 2 - kk; sf[c++] = mag[off + kk]; }
      const P = medianInto(sf, c);
      c = 0; for (let d = -rT; d <= rT; d++) { let ff = f + d; if (ff < 0) ff = 0; if (ff >= numFrames) ff = numFrames - 1; st[c++] = mag[ff * half + k]; }
      const H = medianInto(st, c);
      const hh = H * H, pp = P * P, den = hh + pp + 1e-12;
      maskH[k] = hh / den;
    }
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
    if ((f & 127) === 0) onProgress(0.5 + (f / numFrames) * 0.5);
  }
  const H = new Float32Array(N), Pc = new Float32Array(N);
  for (let i = 0; i < N; i++) { const w = wsum[i] > 1e-6 ? wsum[i] : 1; H[i] = outH[i] / w; Pc[i] = outP[i] / w; }
  return { harmonic: H, percussive: Pc };
}

self.onmessage = (e) => {
  const { mono, sampleRate, fftSize, hop, rF, rT, jobId } = e.data;
  try {
    const monoF32 = new Float32Array(mono);
    const { harmonic, percussive } = hpss(monoF32, sampleRate, fftSize, hop, rF, rT, (p) => {
      self.postMessage({ type: "progress", jobId, p });
    });
    self.postMessage(
      { type: "done", jobId, harmonic: harmonic.buffer, percussive: percussive.buffer },
      [harmonic.buffer, percussive.buffer]
    );
  } catch (err) {
    self.postMessage({ type: "error", jobId, message: err && err.message ? err.message : String(err) });
  }
};
