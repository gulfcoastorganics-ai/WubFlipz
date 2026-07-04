/* wubflipz — minimal dependency-free radix-2 FFT (in-place, iterative Cooley-Tukey).
 * Operates on separate real/imag Float32Array/Array of power-of-two length.
 * No node_modules, no external libs.
 */
(function () {
  "use strict";
  const WF = (window.WF = window.WF || {});

  function transform(re, im, inverse) {
    const n = re.length;
    if (n <= 1) return;
    if ((n & (n - 1)) !== 0) throw new Error("FFT length must be a power of 2, got " + n);
    // bit-reversal permutation
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { const tr = re[i]; re[i] = re[j]; re[j] = tr; const ti = im[i]; im[i] = im[j]; im[j] = ti; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = (inverse ? 2 : -2) * Math.PI / len;
      const wr = Math.cos(ang), wi = Math.sin(ang);
      const half = len >> 1;
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < half; k++) {
          const ar = re[i + k], ai = im[i + k];
          const j = i + k + half;
          const br = re[j], bi = im[j];
          const tr = br * cr - bi * ci, ti = br * ci + bi * cr;
          re[i + k] = ar + tr; im[i + k] = ai + ti;
          re[j] = ar - tr; im[j] = ai - ti;
          const ncr = cr * wr - ci * wi;
          ci = cr * wi + ci * wr; cr = ncr;
        }
      }
    }
    if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
  }

  WF.FFT = {
    fft: (re, im) => transform(re, im, false),
    ifft: (re, im) => transform(re, im, true),
  };
})();
