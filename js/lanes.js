/* wubflipz — Stage 4 per-stem DAW lanes
 * One lane per track (original + Quick Split derivations). Per-lane waveform, volume,
 * pan, mute, solo. All lanes play from ONE shared transport, scheduled against a single
 * AudioContext clock (WF.Player.ctx) at a common start time -> sample-accurate sync.
 * (No per-lane timers.) Lane reordering is deferred — see STATUS_LOG.
 */
(function () {
  "use strict";
  const WF = (window.WF = window.WF || {});
  const $ = (id) => document.getElementById(id);
  const fmt = (t) => { t = Math.max(0, t | 0); return `${(t / 60) | 0}:${String(t % 60).padStart(2, "0")}`; };

  const L = {
    lanes: [], master: null, playing: false, startTime: 0, offset: 0, raf: 0,
    settings: new Map(), // track.id -> {vol,pan,mute,solo}
  };
  WF.Lanes = L;

  function ctx() { return WF.Player && WF.Player.ctx; }
  function ensureMaster() {
    const c = ctx(); if (!c) return null;
    if (!L.master) { L.master = c.createGain(); L.master.gain.value = 1; L.master.connect(c.destination); }
    return L.master;
  }
  function maxDur() { return L.lanes.reduce((m, l) => Math.max(m, l.track.buffer.duration), 0.0001); }
  const anySolo = () => L.lanes.some((l) => l.solo);

  function applyGains() {
    const c = ctx(); if (!c) return; const solo = anySolo();
    L.lanes.forEach((l) => { const g = l.mute ? 0 : (solo ? (l.solo ? l.vol : 0) : l.vol); l.gainNode.gain.setTargetAtTime(g, c.currentTime, 0.01); });
  }

  // ---- transport (shared clock) ----
  function position() {
    if (!L.playing) return L.offset;
    let t = L.offset + (ctx().currentTime - L.startTime);
    const lp = WF.Player && WF.Player.loop;
    if (lp && lp.on) { const len = lp.b - lp.a; if (len > 0 && t > lp.b) t = lp.a + ((t - lp.a) % len); }
    else if (t > maxDur()) t = maxDur();
    return t;
  }
  function play() {
    const c = ctx(); if (!c || !L.lanes.length) return;
    if (c.state === "suspended") c.resume();
    if (WF.Player && WF.Player.playing) WF.Player.pause(); // don't double-play the original
    if (L.playing) return;
    const t0 = c.currentTime + 0.06; // small shared lead so every lane starts on the same tick
    const off = L.offset;
    const lp = WF.Player && WF.Player.loop;
    L.lanes.forEach((l) => {
      const s = c.createBufferSource(); s.buffer = l.track.buffer; s.connect(l.gainNode);
      if (lp && lp.on) { s.loop = true; s.loopStart = lp.a; s.loopEnd = lp.b; }
      let o = off; if (lp && lp.on && (o < lp.a || o >= lp.b)) o = lp.a;
      s.start(t0, o); l.source = s;
    });
    L.startTime = t0; L.offset = off; L.playing = true; applyGains(); updateBtns(); tick();
  }
  function stopSources() { L.lanes.forEach((l) => { if (l.source) { try { l.source.stop(); } catch (e) {} l.source = null; } }); }
  function pause() { if (!L.playing) return; L.offset = position(); stopSources(); L.playing = false; updateBtns(); }
  function stop() { const lp = WF.Player && WF.Player.loop; stopSources(); L.playing = false; L.offset = lp && lp.on ? lp.a : 0; updateBtns(); drawPlayhead(); }
  function toggle() { L.playing ? pause() : play(); }
  function seek(t) { t = Math.max(0, Math.min(maxDur(), t)); if (L.playing) { pause(); L.offset = t; play(); } else { L.offset = t; drawPlayhead(); } }

  function tick() {
    drawPlayhead();
    const lp = WF.Player && WF.Player.loop;
    if (L.playing && !(lp && lp.on) && position() >= maxDur() - 1e-3) { stop(); return; }
    if (L.playing) L.raf = requestAnimationFrame(tick);
  }

  // ---- rendering ----
  function drawPlayhead() {
    const ph = $("lanesPlayhead"); if (!ph) return;
    const wrap = $("lanesContainer"); if (!wrap) return;
    const frac = position() / maxDur();
    ph.style.left = (frac * 100).toFixed(3) + "%";
    ph.style.display = L.lanes.length ? "block" : "none";
    const tr = $("lanesTime"); if (tr) tr.textContent = `${fmt(position())} / ${fmt(maxDur())}`;
  }
  function drawLaneWave(l) {
    const cv = l.canvas; if (!cv || !l.summary) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = cv.getBoundingClientRect();
    cv.width = Math.max(1, Math.round(rect.width * dpr)); cv.height = Math.max(1, Math.round(rect.height * dpr));
    const g = cv.getContext("2d");
    const sr = l.track.buffer.sampleRate;
    // draw against the SHARED time axis (0..maxDur) so all lanes line up under one playhead
    const visSamples = maxDur() * sr;
    WF.Waveform.drawPeaks(g, l.summary, { width: cv.width, height: cv.height, startSample: 0, endSample: visSamples, color: l.color, bg: "#070a08" });
    if (WF.Grid && WF.Grid.overlayFull) WF.Grid.overlayFull(g, { width: cv.width, height: cv.height, maxDur: maxDur() });
  }

  function updateBtns() { const b = $("lanesPlay"); if (b) { b.textContent = L.playing ? "Pause" : "Play"; b.classList.toggle("on", L.playing); } }

  const COLORS = ["#6fe4a6", "#f6b23c", "#7db4ff", "#e07de0", "#e0d27d"];

  async function rebuild(list) {
    // tear down old audio nodes
    stopSources(); L.playing = false;
    L.lanes.forEach((l) => { try { l.gainNode.disconnect(); l.panNode.disconnect(); } catch (e) {} });
    L.lanes = [];
    const wrap = $("lanesContainer"); if (!wrap) return;
    // preserve the playhead element, clear lane rows
    [...wrap.querySelectorAll(".lane")].forEach((n) => n.remove());
    const c = ctx();
    if (!list.length || !c) { drawPlayhead(); return; }
    ensureMaster();

    list.forEach((track, i) => {
      const st = L.settings.get(track.id) || { vol: 0.85, pan: 0, mute: false, solo: false };
      L.settings.set(track.id, st);
      const gainNode = c.createGain(); gainNode.gain.value = st.vol;
      const panNode = c.createStereoPanner ? c.createStereoPanner() : c.createGain();
      if (panNode.pan) panNode.pan.value = st.pan;
      gainNode.connect(panNode); panNode.connect(L.master);

      const row = document.createElement("div"); row.className = "lane";
      row.innerHTML =
        `<div class="lane-head">
           <span class="lane-name">${track.name}</span>
           <div class="lane-btns">
             <button class="lane-m" title="Mute">M</button>
             <button class="lane-s" title="Solo">S</button>
           </div>
           <label class="lane-ctl">Vol<input type="range" class="lane-vol" min="0" max="1" step="0.01" value="${st.vol}"></label>
           <label class="lane-ctl">Pan<input type="range" class="lane-pan" min="-1" max="1" step="0.02" value="${st.pan}"></label>
         </div>
         <div class="lane-wave"><canvas></canvas></div>`;
      // insert before playhead so the playhead overlay stays on top
      wrap.insertBefore(row, $("lanesPlayhead"));
      const lane = { track, gainNode, panNode, source: null, color: COLORS[i % COLORS.length],
        canvas: row.querySelector("canvas"), summary: null, vol: st.vol, pan: st.pan, mute: st.mute, solo: st.solo };

      const mBtn = row.querySelector(".lane-m"), sBtn = row.querySelector(".lane-s");
      mBtn.classList.toggle("on", lane.mute); sBtn.classList.toggle("on", lane.solo);
      mBtn.addEventListener("click", () => { lane.mute = !lane.mute; st.mute = lane.mute; mBtn.classList.toggle("on", lane.mute); applyGains(); });
      sBtn.addEventListener("click", () => { lane.solo = !lane.solo; st.solo = lane.solo; sBtn.classList.toggle("on", lane.solo); applyGains(); });
      row.querySelector(".lane-vol").addEventListener("input", (e) => { lane.vol = +e.target.value; st.vol = lane.vol; applyGains(); });
      row.querySelector(".lane-pan").addEventListener("input", (e) => { lane.pan = +e.target.value; st.pan = lane.pan; if (lane.panNode.pan) lane.panNode.pan.setTargetAtTime(lane.pan, c.currentTime, 0.01); });
      lane.canvas.addEventListener("pointerdown", (e) => { const r = lane.canvas.getBoundingClientRect(); seek(((e.clientX - r.left) / r.width) * maxDur()); });

      L.lanes.push(lane);
    });
    applyGains();

    // summarize + draw each lane's waveform (reuse Player summary for the original)
    for (const lane of L.lanes) {
      if (lane.track.kind === "original" && WF.Player.summary && lane.track.buffer === WF.Player.buffer) lane.summary = WF.Player.summary;
      else lane.summary = await WF.Waveform.summarize(lane.track.buffer);
      drawLaneWave(lane);
    }
    drawPlayhead();
  }

  function initUI() {
    $("lanesPlay").addEventListener("click", toggle);
    $("lanesStop").addEventListener("click", stop);
    window.addEventListener("resize", () => L.lanes.forEach(drawLaneWave));
    if (WF.Tracks) { WF.Tracks.onChange.push(rebuild); rebuild(WF.Tracks.list); }
  }

  Object.assign(L, { play, pause, stop, toggle, seek, position, rebuild, redraw: () => L.lanes.forEach(drawLaneWave) });
  if ($("lanesContainer")) initUI();
})();
