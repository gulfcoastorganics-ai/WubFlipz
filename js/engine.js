/* wubflipz — audio engine
 * Web Audio graph, voice management, wobble/growl/sub/waveshaper modulation.
 * No build step. Exposes a small API on window.WF.
 *
 * Signal path (top layer and sub are compressed SEPARATELY, merged post-comp):
 *   per voice: oscA \
 *              oscB  > mix -> VCA(ADSR) -> [ modFilter ] -> preBus -> shaper(drive) -> topLimiter --\
 *                                                                                                    > sumBus -> master -> outCeiling -> analyser -> out
 *              subOsc -> subVCA(ADSR) -> subBus -> subCeiling ------------------------------------- /
 *   (sub bypasses the modulated filter, the shared shaper, AND the top limiter. The ONE
 *    shared dynamics stage is outCeiling: a -1 dB clip-safety brickwall on the merged
 *    bus. Where it engages, the alternative is hard digital clipping of the sum, which
 *    no per-bus stage can prevent. Watch the "GR OUT" meter: it should sit at 0.0 at
 *    performance levels — if it moves, back master off. See STATUS_LOG "FIX S1".)
 *
 * Modulation:
 *   wobbleLFO -> wobbleDepth ------------------> modFilter.detune  (tempo-synced, cents)
 *   growlLFO  -> growlAmt --> gCut ------------> modFilter.detune
 *                        \--> gQ --------------> modFilter.Q
 *                        \--> gPitch ----------> (per-voice) oscA.detune, oscB.detune
 */
(function () {
  "use strict";
  const WF = (window.WF = window.WF || {});

  // ------------------------------------------------------------------ state
  const state = {
    // oscillators (main layer)
    oscA: "sawtooth", oscB: "square", detune: 9, mix: 0.4, octave: 0,
    // sub layer
    subOn: true, subWave: "sine", subOctave: -1, subLevel: 0.85,
    // filter (modulated by wobble + growl)
    cutoff: 700, q: 7,
    // amplitude envelope
    attack: 0.005, decay: 0.12, sustain: 0.85, release: 0.22,
    // wobble LFO (tempo-synced)
    wobbleOn: true, bpm: 140, halfTime: false, wobbleDiv: "1/8", wobbleDepth: 0.7, wobbleWave: "sine",
    // growl LFO (fast, layered)
    growlAmount: 0.0, growlRate: 14, growlWave: "triangle",
    // drive / saturation
    drive: 0.18,
    // output
    master: 0.8,
  };
  WF.state = state;

  // -------------------------------------------------------------- constants
  const MAX_VOICES = 16;
  // beats-per-cycle per musical division (dotted = ×1.5 longer, triplet = ×2/3 shorter)
  const WOBBLE_DIVS = {
    "1/1": 4, "1/2": 2, "1/2.": 3, "1/2T": 8 / 3,
    "1/4": 1, "1/4.": 1.5, "1/4T": 2 / 3,
    "1/8": 0.5, "1/8.": 0.75, "1/8T": 1 / 3,
    "1/16": 0.25, "1/16.": 0.375, "1/16T": 1 / 6,
  };
  WF.WOBBLE_DIVS = WOBBLE_DIVS;

  // growl fixed modulation depths (scaled by growlAmount 0..1)
  const GROWL_CUT_CENTS = 2400; // added to filter detune
  const GROWL_Q_AMT = 6;        // added to filter Q
  const GROWL_PITCH_CENTS = 22; // osc pitch drift
  const WOBBLE_MAX_CENTS = 4800; // full wobble depth

  // -------------------------------------------------------------- audio nodes
  const A = { ctx: null, started: false };
  const N = {}; // shared graph nodes
  const voices = new Map(); // playedMidi -> voice object
  let scopeBuf = null;
  let meterBuf = null;
  let freqBuf = null;

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const eqp = (mix) => [Math.cos(mix * Math.PI / 2), Math.sin(mix * Math.PI / 2)];

  function wobbleHz() {
    const beats = (WOBBLE_DIVS[state.wobbleDiv] || 0.5) * (state.halfTime ? 2 : 1);
    return (state.bpm / 60) / beats;
  }

  function makeSaturationCurve(drive) {
    // tanh curve; drive 0 -> ~linear (clean), drive 1 -> hard grit
    const k = drive * drive * 90 + 0.05;
    const n = 2048, curve = new Float32Array(n);
    const norm = Math.tanh(k);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = norm < 1e-6 ? x : Math.tanh(k * x) / norm;
    }
    return curve;
  }

  function ensureAudio() {
    if (A.ctx) { if (A.ctx.state === "suspended") A.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    A.ctx = new AC({ latencyHint: "interactive" });
    const ctx = A.ctx;

    // ---- output bus ----
    // The wobble/growl TOP layer and the SUB layer are compressed on SEPARATE
    // dynamics stages and only merged afterward. If they shared one compressor,
    // the top layer's wobble-rate level swings would drive that compressor's gain
    // reduction and rhythmically duck the (otherwise clean) sub. Keeping them apart
    // is the fix for "sub audibly wobbles under heavy Wobble/Growl".
    N.master = ctx.createGain(); N.master.gain.value = state.master;
    N.sumBus = ctx.createGain(); N.sumBus.gain.value = 1;         // top + sub merge, POST-compression
    // Final SAFETY BRICKWALL only — high threshold so it reads 0.0 dB reduction at
    // normal playing levels and never rides the wobble; engages only on true clipping.
    // (It must NOT act as an active dynamics processor on the merged bus, or it would
    // re-introduce the shared-compressor sub-ducking this whole refactor removed.)
    N.outCeiling = ctx.createDynamicsCompressor();
    N.outCeiling.threshold.value = -1.0; N.outCeiling.knee.value = 0; N.outCeiling.ratio.value = 20;
    N.outCeiling.attack.value = 0.001; N.outCeiling.release.value = 0.05;
    N.analyser = ctx.createAnalyser(); N.analyser.fftSize = 2048; N.analyser.smoothingTimeConstant = 0.82;
    N.meterAnalyser = ctx.createAnalyser(); N.meterAnalyser.fftSize = 2048;
    N.sumBus.connect(N.master);
    N.master.connect(N.outCeiling);
    N.outCeiling.connect(N.analyser);
    N.outCeiling.connect(N.meterAnalyser);
    N.analyser.connect(ctx.destination);

    // top layer: filter -> saturation -> its own limiter -> sum
    N.shaper = ctx.createWaveShaper(); N.shaper.curve = makeSaturationCurve(state.drive); N.shaper.oversample = "4x";
    N.preBus = ctx.createGain(); N.preBus.gain.value = 1;
    N.topLimiter = ctx.createDynamicsCompressor();
    N.topLimiter.threshold.value = -12; N.topLimiter.knee.value = 18; N.topLimiter.ratio.value = 8;
    N.topLimiter.attack.value = 0.003; N.topLimiter.release.value = 0.2;
    N.preBus.connect(N.shaper);
    N.shaper.connect(N.topLimiter);
    N.topLimiter.connect(N.sumBus);

    // ---- modulated filter (top layer only) ----
    N.filter = ctx.createBiquadFilter();
    N.filter.type = "lowpass";
    N.filter.frequency.value = state.cutoff;
    N.filter.Q.value = state.q;
    N.filter.connect(N.preBus);

    // ---- sub bus: bypasses the modulated filter AND the shared shaper/limiter.
    // Its own gentle ceiling catches peaks; because the sub is steady, this ceiling's
    // gain reduction is steady (DC) and never wobbles.
    N.subBus = ctx.createGain();
    N.subBus.gain.value = state.subOn ? state.subLevel : 0;
    N.subCeiling = ctx.createDynamicsCompressor();
    N.subCeiling.threshold.value = -6; N.subCeiling.knee.value = 6; N.subCeiling.ratio.value = 6;
    N.subCeiling.attack.value = 0.005; N.subCeiling.release.value = 0.15;
    N.subBus.connect(N.subCeiling);
    N.subCeiling.connect(N.sumBus);

    // ---- wobble LFO ----
    N.wobbleLFO = ctx.createOscillator(); N.wobbleLFO.type = state.wobbleWave; N.wobbleLFO.frequency.value = wobbleHz();
    N.wobbleDepth = ctx.createGain(); N.wobbleDepth.gain.value = state.wobbleOn ? state.wobbleDepth * WOBBLE_MAX_CENTS : 0;
    N.wobbleLFO.connect(N.wobbleDepth);
    N.wobbleDepth.connect(N.filter.detune);
    N.wobbleLFO.start();

    // ---- growl LFO (fast, layered) ----
    N.growlLFO = ctx.createOscillator(); N.growlLFO.type = state.growlWave; N.growlLFO.frequency.value = state.growlRate;
    N.growlAmt = ctx.createGain(); N.growlAmt.gain.value = state.growlAmount;
    N.gCut = ctx.createGain(); N.gCut.gain.value = GROWL_CUT_CENTS;
    N.gQ = ctx.createGain(); N.gQ.gain.value = GROWL_Q_AMT;
    N.gPitch = ctx.createGain(); N.gPitch.gain.value = GROWL_PITCH_CENTS;
    N.growlLFO.connect(N.growlAmt);
    N.growlAmt.connect(N.gCut); N.gCut.connect(N.filter.detune);
    N.growlAmt.connect(N.gQ); N.gQ.connect(N.filter.Q);
    N.growlAmt.connect(N.gPitch); // gPitch fans out to each voice's osc detune
    N.growlLFO.start();

    A.started = true;
    scopeBuf = new Float32Array(N.analyser.fftSize);
    meterBuf = new Float32Array(N.meterAnalyser.fftSize);
    freqBuf = new Float32Array(N.analyser.frequencyBinCount);
    WF.Engine._onStart && WF.Engine._onStart();
  }

  // -------------------------------------------------------------- voices
  function baseMidi(playedMidi) { return playedMidi + state.octave * 12; }

  function applyEnv(param, peak, t) {
    param.cancelScheduledValues(t);
    param.setValueAtTime(0.0001, t);
    param.linearRampToValueAtTime(peak, t + state.attack + 0.001);
    param.linearRampToValueAtTime(Math.max(0.0001, peak * state.sustain), t + state.attack + state.decay + 0.002);
  }

  function disposeVoice(v) {
    try { N.gPitch.disconnect(v.oscA.detune); } catch (e) {}
    try { N.gPitch.disconnect(v.oscB.detune); } catch (e) {}
    try {
      v.oscA.disconnect(); v.oscB.disconnect(); v.gA.disconnect(); v.gB.disconnect();
      v.vca.disconnect(); v.subOsc.disconnect(); v.subVCA.disconnect();
    } catch (e) {}
  }

  function stealOldest() {
    const oldest = voices.keys().next().value;
    if (oldest !== undefined) noteOff(oldest, true);
  }

  function noteOn(playedMidi, vel = 0.85) {
    ensureAudio();
    if (A.ctx.state === "suspended") A.ctx.resume();
    if (voices.has(playedMidi)) return;
    while (voices.size >= MAX_VOICES) stealOldest();

    const ctx = A.ctx, t = ctx.currentTime;
    const bm = baseMidi(playedMidi);
    const f = mtof(bm);

    const oscA = ctx.createOscillator(); oscA.type = state.oscA; oscA.frequency.value = f;
    const oscB = ctx.createOscillator(); oscB.type = state.oscB; oscB.frequency.value = f; oscB.detune.value = state.detune;
    const gA = ctx.createGain(), gB = ctx.createGain();
    const [ga, gb] = eqp(state.mix); gA.gain.value = ga; gB.gain.value = gb;
    const vca = ctx.createGain(); vca.gain.value = 0.0001;
    oscA.connect(gA).connect(vca);
    oscB.connect(gB).connect(vca);
    vca.connect(N.filter);

    // sub layer: pure osc, its own VCA, straight to subBus (no wobble/growl)
    const subOsc = ctx.createOscillator();
    subOsc.type = state.subWave;
    subOsc.frequency.value = mtof(bm + state.subOctave * 12);
    const subVCA = ctx.createGain(); subVCA.gain.value = 0.0001;
    subOsc.connect(subVCA).connect(N.subBus);

    // growl pitch drift onto both main oscillators
    try { N.gPitch.connect(oscA.detune); N.gPitch.connect(oscB.detune); } catch (e) {}

    const peak = Math.max(0.02, vel);
    applyEnv(vca.gain, peak, t);
    applyEnv(subVCA.gain, peak, t);

    oscA.start(t); oscB.start(t); subOsc.start(t);

    const v = { playedMidi, oscA, oscB, gA, gB, vca, subOsc, subVCA };
    oscA.onended = () => { disposeVoice(v); WF.Engine._onVoices && WF.Engine._onVoices(voices.size); };
    voices.set(playedMidi, v);
    WF.Engine._onVoices && WF.Engine._onVoices(voices.size);
    WF.Engine._onNoteOn && WF.Engine._onNoteOn(playedMidi);
  }

  function noteOff(playedMidi, fast = false) {
    const v = voices.get(playedMidi);
    if (!v) return;
    voices.delete(playedMidi);
    WF.Engine._onNoteOff && WF.Engine._onNoteOff(playedMidi);
    const t = A.ctx.currentTime;
    const rel = fast ? 0.03 : state.release;
    for (const g of [v.vca.gain, v.subVCA.gain]) {
      if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(t);
      else { g.cancelScheduledValues(t); g.setValueAtTime(Math.max(0.0001, g.value), t); }
      g.linearRampToValueAtTime(0.0001, t + rel + 0.01);
    }
    const end = t + rel + 0.04;
    try { v.oscA.stop(end); v.oscB.stop(end); v.subOsc.stop(end); } catch (e) {}
  }

  function allNotesOff() { for (const m of [...voices.keys()]) noteOff(m, true); }

  function emergencyStop() {
    if (!A.ctx) return;
    const t = A.ctx.currentTime;
    if (N.master) {
      N.master.gain.cancelScheduledValues(t);
      N.master.gain.setValueAtTime(N.master.gain.value, t);
      N.master.gain.linearRampToValueAtTime(0, t + 0.01);
    }
    setTimeout(() => {
      for (const v of [...voices.values()]) {
        WF.Engine._onNoteOff && WF.Engine._onNoteOff(v.playedMidi);
        try { v.vca.gain.cancelScheduledValues(A.ctx.currentTime); v.vca.gain.setValueAtTime(0, A.ctx.currentTime); } catch (e) {}
        try { v.subVCA.gain.cancelScheduledValues(A.ctx.currentTime); v.subVCA.gain.setValueAtTime(0, A.ctx.currentTime); } catch (e) {}
        try { v.oscA.stop(0); } catch (e) {}
        try { v.oscB.stop(0); } catch (e) {}
        try { v.subOsc.stop(0); } catch (e) {}
        disposeVoice(v);
      }
      voices.clear();
      if (N.master) N.master.gain.setValueAtTime(state.master, A.ctx.currentTime);
      WF.Engine._onVoices && WF.Engine._onVoices(0);
    }, 12);
  }

  // -------------------------------------------------------------- live params
  function onParam(param) {
    if (!A.started) return;
    const ctx = A.ctx, now = ctx.currentTime, s = state;
    switch (param) {
      case "cutoff": N.filter.frequency.setTargetAtTime(s.cutoff, now, 0.01); break;
      case "q": N.filter.Q.setTargetAtTime(s.q, now, 0.01); break;
      case "master": N.master.gain.setTargetAtTime(s.master, now, 0.02); break;
      case "drive": N.shaper.curve = makeSaturationCurve(s.drive); break;
      case "detune": for (const v of voices.values()) v.oscB.detune.setTargetAtTime(s.detune, now, 0.01); break;
      case "mix": {
        const [ga, gb] = eqp(s.mix);
        for (const v of voices.values()) { v.gA.gain.setTargetAtTime(ga, now, 0.01); v.gB.gain.setTargetAtTime(gb, now, 0.01); }
        break;
      }
      case "oscA": for (const v of voices.values()) v.oscA.type = s.oscA; break;
      case "oscB": for (const v of voices.values()) v.oscB.type = s.oscB; break;
      case "octave":
        for (const v of voices.values()) {
          const bm = baseMidi(v.playedMidi);
          v.oscA.frequency.setTargetAtTime(mtof(bm), now, 0.01);
          v.oscB.frequency.setTargetAtTime(mtof(bm), now, 0.01);
          v.subOsc.frequency.setTargetAtTime(mtof(bm + s.subOctave * 12), now, 0.01);
        }
        break;
      case "subOn": case "subLevel":
        N.subBus.gain.setTargetAtTime(s.subOn ? s.subLevel : 0, now, 0.02); break;
      case "subWave": for (const v of voices.values()) v.subOsc.type = s.subWave; break;
      case "subOctave":
        for (const v of voices.values()) v.subOsc.frequency.setTargetAtTime(mtof(baseMidi(v.playedMidi) + s.subOctave * 12), now, 0.01);
        break;
      case "bpm": case "halfTime": case "wobbleDiv":
        N.wobbleLFO.frequency.setTargetAtTime(wobbleHz(), now, 0.02); break;
      case "wobbleWave": N.wobbleLFO.type = s.wobbleWave; break;
      case "wobbleDepth": case "wobbleOn":
        N.wobbleDepth.gain.setTargetAtTime(s.wobbleOn ? s.wobbleDepth * WOBBLE_MAX_CENTS : 0, now, 0.02); break;
      case "growlAmount": N.growlAmt.gain.setTargetAtTime(s.growlAmount, now, 0.02); break;
      case "growlRate": N.growlLFO.frequency.setTargetAtTime(s.growlRate, now, 0.02); break;
      case "growlWave": N.growlLFO.type = s.growlWave; break;
    }
  }

  // apply the whole state to the running graph (used after preset load)
  function syncAll() {
    ["cutoff","q","master","drive","detune","mix","oscA","oscB","octave",
     "subOn","subWave","subOctave","bpm","wobbleWave","wobbleDepth","growlAmount",
     "growlRate","growlWave"].forEach(onParam);
  }

  // -------------------------------------------------------------- API
  WF.Engine = {
    ensureAudio, noteOn, noteOff, allNotesOff, emergencyStop, onParam, syncAll, wobbleHz,
    get ctx() { return A.ctx; },
    get started() { return A.started; },
    voiceCount: () => voices.size,
    getTimeData: (buf) => { if (N.analyser) N.analyser.getFloatTimeDomainData(buf); return buf; },
    getFreqData: (buf) => { if (N.analyser) N.analyser.getFloatFrequencyData(buf || freqBuf); return buf || freqBuf; },
    get sampleRate() { return A.ctx ? A.ctx.sampleRate : 44100; },
    getOutputPeak() {
      if (!N.meterAnalyser || !meterBuf) return { mono: 0, left: 0, right: 0 };
      N.meterAnalyser.getFloatTimeDomainData(meterBuf);
      let peak = 0;
      for (let i = 0; i < meterBuf.length; i++) peak = Math.max(peak, Math.abs(meterBuf[i]));
      return { mono: peak, left: peak, right: peak };
    },
    getReduction: () => ({ top: N.topLimiter ? N.topLimiter.reduction : 0, sub: N.subCeiling ? N.subCeiling.reduction : 0, out: N.outCeiling ? N.outCeiling.reduction : 0 }),
    get scopeBuffer() { return scopeBuf; },
    _onStart: null,   // set by ui
    _onVoices: null,  // set by ui
    _onNoteOn: null,  // set by ui
    _onNoteOff: null, // set by ui
    MAX_VOICES,
  };
})();
