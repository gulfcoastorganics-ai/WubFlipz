/* wubflipz — waveform utilities (reused by file player, lanes, beat grid)
 * Peak-based (min/max per block) summaries so long files render fast, computed in
 * chunks off the render path so the UI never blocks on a big decode.
 */
(function () {
  "use strict";
  const WF = (window.WF = window.WF || {});

  // Build a mono min/max peak summary from an AudioBuffer, chunked with progress.
  // Returns { min:Float32Array, max:Float32Array, blockSize, blocks, sampleRate, length }.
  function summarize(audioBuffer, onProgress) {
    return new Promise((resolve) => {
      const ch = audioBuffer.numberOfChannels;
      const len = audioBuffer.length;
      const data = [];
      for (let c = 0; c < ch; c++) data.push(audioBuffer.getChannelData(c));
      // ~200k blocks max keeps memory small and draws fast even for long tracks
      const blockSize = Math.max(64, Math.ceil(len / 200000));
      const blocks = Math.ceil(len / blockSize);
      const min = new Float32Array(blocks), max = new Float32Array(blocks);
      let b = 0;
      const BLOCKS_PER_TICK = 4000; // yield to the event loop between chunks
      function step() {
        const end = Math.min(blocks, b + BLOCKS_PER_TICK);
        for (; b < end; b++) {
          let lo = 1, hi = -1;
          const s0 = b * blockSize, s1 = Math.min(len, s0 + blockSize);
          for (let i = s0; i < s1; i++) {
            let v = 0;
            for (let c = 0; c < ch; c++) v += data[c][i];
            v /= ch;
            if (v < lo) lo = v;
            if (v > hi) hi = v;
          }
          if (lo > hi) { lo = 0; hi = 0; }
          min[b] = lo; max[b] = hi;
        }
        if (onProgress) onProgress(b / blocks);
        if (b < blocks) setTimeout(step, 0);
        else resolve({ min, max, blockSize, blocks, sampleRate: audioBuffer.sampleRate, length: len });
      }
      step();
    });
  }

  // Draw a peak summary for the sample window [startSample, endSample) into a 2D context.
  function drawPeaks(g, summary, opts) {
    const { width: W, height: H } = opts;
    const startSample = opts.startSample | 0;
    const endSample = Math.max(startSample + 1, opts.endSample | 0);
    const color = opts.color || "#6fe4a6";
    const bg = opts.bg;
    const mid = H / 2, amp = (H / 2) * 0.94;
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, W, H); }
    // zero line
    g.strokeStyle = "rgba(255,255,255,0.10)"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, mid); g.lineTo(W, mid); g.stroke();
    const bs = summary.blockSize, nb = summary.blocks;
    g.strokeStyle = color; g.lineWidth = 1;
    g.beginPath();
    for (let x = 0; x < W; x++) {
      const sa = startSample + ((endSample - startSample) * x) / W;
      const sb = startSample + ((endSample - startSample) * (x + 1)) / W;
      let ba = Math.floor(sa / bs), bb = Math.max(ba + 1, Math.ceil(sb / bs));
      ba = Math.max(0, Math.min(nb - 1, ba)); bb = Math.max(0, Math.min(nb, bb));
      let lo = 1, hi = -1;
      for (let b = ba; b < bb; b++) { if (summary.min[b] < lo) lo = summary.min[b]; if (summary.max[b] > hi) hi = summary.max[b]; }
      if (lo > hi) { lo = 0; hi = 0; }
      const y1 = mid - hi * amp, y2 = mid - lo * amp;
      g.moveTo(x + 0.5, y1); g.lineTo(x + 0.5, Math.max(y2, y1 + 0.5));
    }
    g.stroke();
  }

  WF.Waveform = { summarize, drawPeaks };
})();
