/* wubflipz — single visual frame driver
 * Visual callbacks read state only; they never schedule or drive audio.
 */
(function () {
  "use strict";
  const WF = (window.WF = window.WF || {});
  const callbacks = new Map();
  const deltas = [];
  const mq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  let raf = 0, last = 0, fps = 0, frameCount = 0;

  function reduced() { return !!(mq && mq.matches); }
  function parked() { return document.hidden || reduced(); }
  function computeFps(ts) {
    if (last) {
      deltas.push(ts - last);
      if (deltas.length > 30) deltas.shift();
      const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
      fps = avg > 0 ? 1000 / avg : 0;
    }
    last = ts;
  }
  function runOnce(ts) {
    callbacks.forEach((fn, name) => {
      try { fn(ts || performance.now()); }
      catch (e) { console.warn(`WF.Viz callback failed: ${name}`, e); }
    });
  }
  function loop(ts) {
    raf = 0;
    if (parked()) return;
    frameCount++;
    computeFps(ts);
    runOnce(ts);
    raf = requestAnimationFrame(loop);
  }
  function start() {
    if (raf || parked()) return;
    last = 0;
    raf = requestAnimationFrame(loop);
  }
  function stop() {
    if (!raf) return;
    cancelAnimationFrame(raf);
    raf = 0;
  }
  function sync() {
    if (parked()) { stop(); runOnce(performance.now()); }
    else start();
  }
  function register(name, fn) {
    callbacks.set(name, fn);
    runOnce(performance.now());
    start();
    return () => callbacks.delete(name);
  }

  document.addEventListener("visibilitychange", sync);
  if (mq) {
    if (mq.addEventListener) mq.addEventListener("change", sync);
    else if (mq.addListener) mq.addListener(sync);
  }

  WF.Viz = {
    register,
    start,
    stop,
    get fps() { return fps; },
    get frameCount() { return frameCount; },
    get callbackCount() { return callbacks.size; },
    get reducedMotion() { return reduced(); },
  };
})();
