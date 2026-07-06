/* wubflipz — Stage 2 file player
 * Upload (drag-drop + picker), decodeAudioData (off main thread), peak waveform,
 * transport (play/pause/stop, click-seek, loop-region select, zoom).
 * Runs on its OWN AudioContext + BufferSource — never shares nodes with the synth voices.
 */
(function () {
  "use strict";
  const WF = (window.WF = window.WF || {});
  const $ = (id) => document.getElementById(id);
  const fmtTime = (t) => { t = Math.max(0, t | 0); return `${(t / 60) | 0}:${String(t % 60).padStart(2, "0")}`; };

  const P = {
    ctx: null, buffer: null, summary: null, duration: 0,
    view: { start: 0, end: 0 },
    loop: { on: false, a: 0, b: 0 },
    playing: false, pausedPos: 0, startCtxTime: 0, startOffset: 0,
    source: null, gain: null, analyser: null, _manualStop: false, _sel: null,
    onLoaded: [],   // Stage 3/4/5 hook: cb(buffer)
  };
  WF.Player = P;

  function ensureCtx() {
    if (P.ctx) { if (P.ctx.state === "suspended") P.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    P.ctx = new AC({ latencyHint: "interactive" });
    P.gain = P.ctx.createGain(); P.gain.value = 1;
    P.analyser = P.ctx.createAnalyser(); P.analyser.fftSize = 2048;
    P.gain.connect(P.analyser); P.analyser.connect(P.ctx.destination);
    // honest stereo metering taps (fix-s1): the meter bridge reads true per-channel
    // peaks and MEASURED correlation from these instead of assuming +1.00
    if (P.ctx.createChannelSplitter) {
      P.splitter = P.ctx.createChannelSplitter(2);
      P.gain.connect(P.splitter);
      P.analyserL = P.ctx.createAnalyser(); P.analyserL.fftSize = 2048;
      P.analyserR = P.ctx.createAnalyser(); P.analyserR.fftSize = 2048;
      P.splitter.connect(P.analyserL, 0);
      P.splitter.connect(P.analyserR, 1);
    }
  }

  // ---- load / decode / summarize (non-blocking) ----
  async function loadFile(file) {
    if (!file) return;
    ensureCtx();
    emergencyStop();
    $("fileName").textContent = file.name;
    setProgress(0, "decoding…");
    let ab;
    try { ab = await file.arrayBuffer(); } catch (e) { return fail("Could not read file"); }
    let buf;
    try { buf = await P.ctx.decodeAudioData(ab); }
    catch (e) { return fail("Unsupported or corrupt audio"); }
    P.buffer = buf; P.duration = buf.duration;
    P.view = { start: 0, end: buf.duration };
    P.loop = { on: false, a: 0, b: buf.duration };
    P.pausedPos = 0; P.playing = false;
    setProgress(0, "analysing…");
    P.summary = await WF.Waveform.summarize(buf, (p) => setProgress(p, "analysing…"));
    hideProgress();
    $("fileDur").textContent = fmtTime(buf.duration) + `  ·  ${buf.numberOfChannels === 1 ? "mono" : "stereo"} ${(buf.sampleRate / 1000).toFixed(1)}k`;
    updateButtons(); render();
    window.dispatchEvent(new CustomEvent("wf:sample-loaded", { detail: { name: file.name, duration: buf.duration } }));
    window.dispatchEvent(new CustomEvent("wf:status", { detail: { title: "Sample Loaded", detail: "Analyze sample next." } }));
    window.dispatchEvent(new CustomEvent("wf:next-step", { detail: { title: "Analyze Sample", detail: "Detect tempo, key, and beat grid.", target: "analyzeBoard" } }));
    P.onLoaded.forEach((cb) => { try { cb(buf); } catch (e) {} });
  }
  function fail(msg) {
    hideProgress(); $("fileName").textContent = msg;
    window.dispatchEvent(new CustomEvent("wf:status", { detail: { title: "Sample Load Failed", detail: msg, tone: "fail" } }));
  }
  function setProgress(p, label) {
    const wrap = $("decodeProg"); wrap.style.display = "block";
    $("decodeBar").style.width = Math.round((p || 0) * 100) + "%";
    $("decodeBar").dataset.label = label || "";
  }
  function hideProgress() { $("decodeProg").style.display = "none"; }

  // ---- transport ----
  function position() {
    if (!P.playing) return P.pausedPos;
    let t = P.startOffset + (P.ctx.currentTime - P.startCtxTime);
    if (P.loop.on) { const L = P.loop.b - P.loop.a; if (L > 0 && t > P.loop.b) t = P.loop.a + ((t - P.loop.a) % L); }
    else if (t > P.duration) t = P.duration;
    return t;
  }
  function play() {
    if (!P.buffer || P.playing) return;
    ensureCtx(); if (P.ctx.state === "suspended") P.ctx.resume();
    const src = P.ctx.createBufferSource(); src.buffer = P.buffer; src.connect(P.gain);
    let offset = P.pausedPos;
    if (P.loop.on) { src.loop = true; src.loopStart = P.loop.a; src.loopEnd = P.loop.b; if (offset < P.loop.a || offset >= P.loop.b) offset = P.loop.a; }
    P._manualStop = false;
    src.onended = () => { if (P._manualStop) return; P.playing = false; P.pausedPos = P.loop.on ? P.loop.a : 0; updateButtons(); render(); };
    src.start(0, offset);
    P.source = src; P.startCtxTime = P.ctx.currentTime; P.startOffset = offset; P.playing = true;
    updateButtons(); render();
  }
  function pause() {
    if (!P.playing) return;
    P.pausedPos = position(); P._manualStop = true;
    try { P.source.stop(); } catch (e) {}
    P.source = null; P.playing = false; updateButtons(); render();
  }
  function stop() {
    P._manualStop = true; try { P.source && P.source.stop(); } catch (e) {}
    P.source = null; P.playing = false; P.pausedPos = P.loop.on ? P.loop.a : 0; updateButtons(); render();
  }
  function emergencyStop() {
    if (!P.ctx) return;
    const t = P.ctx.currentTime;
    if (P.gain) {
      P.gain.gain.cancelScheduledValues(t);
      P.gain.gain.setValueAtTime(P.gain.gain.value, t);
      P.gain.gain.linearRampToValueAtTime(0, t + 0.01);
    }
    P._manualStop = true; P.playing = false; P.pausedPos = P.loop.on ? P.loop.a : 0;
    const src = P.source; P.source = null;
    setTimeout(() => {
      try { src && src.stop(0); } catch (e) {}
      if (P.gain) P.gain.gain.setValueAtTime(1, P.ctx.currentTime);
      updateButtons(); render();
    }, 12);
  }
  function togglePlay() { P.playing ? pause() : play(); }
  function seek(t) {
    if (WF.Grid) t = WF.Grid.snap(t);   // snap to beat grid when enabled
    t = Math.max(0, Math.min(P.duration, t));
    if (P.playing) { pause(); P.pausedPos = t; play(); } else { P.pausedPos = t; render(); }
  }
  function setLoop(a, b) {
    if (WF.Grid) { a = WF.Grid.snap(a); b = WF.Grid.snap(b); }   // snap loop edges to grid
    if (b < a) [a, b] = [b, a];
    if (b - a < 0.02) return;
    P.loop = { on: true, a, b };
    if (P.playing) { pause(); play(); }
    updateButtons(); render();
  }
  function clearLoop() { P.loop.on = false; updateButtons(); render(); }
  function zoom(factor) {
    if (!P.buffer) return;
    const c = Math.max(P.view.start, Math.min(P.view.end, position()));
    let s = c - (c - P.view.start) * factor, e = c + (P.view.end - c) * factor;
    s = Math.max(0, s); e = Math.min(P.duration, e);
    if (e - s < 0.02) return;
    P.view = { start: s, end: e }; render();
  }

  // ---- render ----
  const cv = () => $("waveCanvas");
  function cssW() { return cv().getBoundingClientRect().width || 1; }
  function timeToXcss(t) { return ((t - P.view.start) / (P.view.end - P.view.start)) * cssW(); }
  function xToTimeCss(x) { return P.view.start + (x / cssW()) * (P.view.end - P.view.start); }
  function render() {
    const c = cv(); if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = c.getBoundingClientRect();
    c.width = Math.max(1, Math.round(rect.width * dpr)); c.height = Math.max(1, Math.round(rect.height * dpr));
    const g = c.getContext("2d"), W = c.width, H = c.height, sx = W / (cssW() || 1);
    g.clearRect(0, 0, W, H);
    g.fillStyle = "#070a08"; g.fillRect(0, 0, W, H);
    if (!P.summary) { g.fillStyle = "#3a4440"; g.font = `${12 * dpr}px ui-monospace, monospace`; g.fillText("no file loaded", 12 * dpr, H / 2); return; }
    const sr = P.buffer.sampleRate;
    WF.Waveform.drawPeaks(g, P.summary, { width: W, height: H, startSample: P.view.start * sr, endSample: P.view.end * sr, color: "#6fe4a6" });
    // loop region (committed) + tentative selection
    const drawRegion = (a, b, fill) => { const x1 = timeToXcss(a) * sx, x2 = timeToXcss(b) * sx; g.fillStyle = fill; g.fillRect(x1, 0, x2 - x1, H); };
    if (P.loop.on) drawRegion(P.loop.a, P.loop.b, "rgba(246,178,60,0.14)");
    if (P._sel) drawRegion(P._sel.a, P._sel.b, "rgba(246,178,60,0.22)");
    // playhead
    const px = timeToXcss(position()) * sx;
    g.strokeStyle = "#f6b23c"; g.lineWidth = 2 * dpr; g.beginPath(); g.moveTo(px, 0); g.lineTo(px, H); g.stroke();
    if (WF.Grid && WF.Grid.overlay) WF.Grid.overlay(g, { W, H, sx, timeToXcss, view: P.view }); // Stage 5 beat grid
    $("timeReadout").textContent = `${fmtTime(position())} / ${fmtTime(P.duration)}` + (P.loop.on ? `  ⟳ ${fmtTime(P.loop.a)}–${fmtTime(P.loop.b)}` : "");
  }
  function updateButtons() {
    $("playBtn").textContent = P.playing ? "Pause" : "Play";
    $("playBtn").classList.toggle("on", P.playing);
    $("loopBtn").classList.toggle("on", P.loop.on);
  }

  // ---- UI wiring ----
  function initUI() {
    const dz = $("dropzone");
    dz.addEventListener("dragover", (e) => { e.preventDefault(); dz.classList.add("over"); });
    dz.addEventListener("dragleave", () => dz.classList.remove("over"));
    dz.addEventListener("drop", (e) => { e.preventDefault(); dz.classList.remove("over"); const f = e.dataTransfer.files[0]; if (f) loadFile(f); });
    $("fileInput").addEventListener("change", (e) => { const f = e.target.files[0]; if (f) loadFile(f); e.target.value = ""; });
    $("playBtn").addEventListener("click", togglePlay);
    $("stopBtn").addEventListener("click", () => { stop(); if (WF.Stems && WF.Stems.stopPreview) WF.Stems.stopPreview(); });
    $("loopBtn").addEventListener("click", () => { if (P.loop.on) clearLoop(); else if (P.buffer) setLoop(P.view.start, P.view.end); });
    $("clearLoopBtn").addEventListener("click", clearLoop);
    $("zoomInBtn").addEventListener("click", () => zoom(0.5));
    $("zoomOutBtn").addEventListener("click", () => zoom(2));

    const c = cv();
    let downX = 0, downT = 0, dragging = false, down = false;
    c.addEventListener("pointerdown", (e) => {
      if (!P.buffer) return;
      down = true; dragging = false; downX = e.offsetX; downT = xToTimeCss(e.offsetX);
      c.setPointerCapture(e.pointerId);
    });
    c.addEventListener("pointermove", (e) => {
      if (!down) return;
      if (Math.abs(e.offsetX - downX) > 4) dragging = true;
      if (dragging) { P._sel = { a: Math.min(downT, xToTimeCss(e.offsetX)), b: Math.max(downT, xToTimeCss(e.offsetX)) }; render(); }
    });
    c.addEventListener("pointerup", (e) => {
      if (!down) return; down = false;
      if (dragging && P._sel) { setLoop(P._sel.a, P._sel.b); P._sel = null; }
      else { seek(downT); }
    });
    window.addEventListener("resize", () => { if (P.summary) render(); });
    render();
    if (WF.Viz) WF.Viz.register("sample-player", () => { if (P.playing) render(); });
  }

  Object.assign(P, { loadFile, play, pause, stop, emergencyStop, togglePlay, seek, setLoop, clearLoop, zoom, position, render });
  if (document.getElementById("dropzone")) initUI();
})();
