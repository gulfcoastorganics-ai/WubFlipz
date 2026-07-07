/* wubflipz — Web MIDI input (Phase 1 item #5)
 * Notes from any connected controller play the synth through the same press/release
 * path the on-screen keyboard uses. Control Change messages can be "learned" onto
 * any knob: click Learn, move a hardware control, the next CC binds to that param.
 * Feature-detected — with no navigator.requestMIDIAccess (or no device connected)
 * the rest of the app behaves exactly as before.
 */
(function () {
  "use strict";
  const WF = (window.WF = window.WF || {});
  const $ = (id) => document.getElementById(id);
  const MAP_KEY = "wubflipz.midi.map.v1";

  let ccToParam = {}; // { [ccNumber]: paramName }
  let learningParam = null;

  function loadMap() {
    try { ccToParam = JSON.parse(localStorage.getItem(MAP_KEY) || "{}") || {}; }
    catch (e) { ccToParam = {}; }
  }
  function saveMap() {
    try { localStorage.setItem(MAP_KEY, JSON.stringify(ccToParam)); } catch (e) {}
  }
  function ccForParam(param) {
    for (const cc in ccToParam) if (ccToParam[cc] === param) return cc;
    return null;
  }

  function setStatus(msg) { const el = $("midiStatus"); if (el) el.textContent = msg; }

  function renderMapList() {
    const el = $("midiMapList");
    if (!el || !WF.UI || !WF.UI.knobParams) return;
    el.innerHTML = "";
    WF.UI.knobParams().forEach(({ param, label }) => {
      const row = document.createElement("div"); row.className = "midi-map-row";
      const nm = document.createElement("span"); nm.className = "midi-map-name"; nm.textContent = label;
      const cc = document.createElement("span"); cc.className = "midi-map-cc";
      const bound = ccForParam(param);
      cc.textContent = learningParam === param ? "move a control…" : (bound != null ? `CC ${bound}` : "unmapped");
      const learnBtn = document.createElement("button"); learnBtn.type = "button"; learnBtn.className = "tbtn";
      if (learningParam === param) learnBtn.classList.add("learning");
      learnBtn.textContent = learningParam === param ? "Cancel" : "Learn";
      learnBtn.addEventListener("click", () => { learningParam = learningParam === param ? null : param; renderMapList(); });
      const clearBtn = document.createElement("button"); clearBtn.type = "button"; clearBtn.className = "tbtn";
      clearBtn.textContent = "Clear";
      clearBtn.disabled = bound == null;
      clearBtn.addEventListener("click", () => { if (bound != null) { delete ccToParam[bound]; saveMap(); renderMapList(); } });
      row.append(nm, cc, learnBtn, clearBtn);
      el.appendChild(row);
    });
  }

  function handleMessage(e) {
    const data = e.data;
    if (!data || data.length < 2) return;
    const status = data[0], cmd = status >> 4;
    if (cmd === 0x9 && data[2] > 0) { WF.UI.pressNote(data[1]); return; } // note on
    if (cmd === 0x8 || (cmd === 0x9 && data[2] === 0)) { WF.UI.releaseNote(data[1]); return; } // note off
    if (cmd === 0xB) { // control change
      const cc = data[1], value = data[2];
      if (learningParam) {
        const prevCc = ccForParam(learningParam);
        if (prevCc != null) delete ccToParam[prevCc];
        ccToParam[cc] = learningParam;
        saveMap();
        learningParam = null;
        renderMapList();
        return;
      }
      const param = ccToParam[cc];
      if (param) WF.UI.setKnobNorm(param, value / 127);
    }
  }

  function attachInput(input) { input.onmidimessage = handleMessage; }

  function refreshInputs(midiAccess) {
    const names = [];
    midiAccess.inputs.forEach((input) => { attachInput(input); names.push(input.name || "MIDI device"); });
    setStatus(names.length ? `Connected: ${names.join(", ")}` : "No MIDI device connected. Plug one in — no setup needed.");
  }

  function init() {
    if (!$("midiBoard")) return;
    loadMap();
    renderMapList();
    if (!navigator.requestMIDIAccess) {
      setStatus("Web MIDI is not supported in this browser.");
      return;
    }
    navigator.requestMIDIAccess()
      .then((midiAccess) => {
        refreshInputs(midiAccess);
        midiAccess.onstatechange = () => refreshInputs(midiAccess);
      })
      .catch(() => setStatus("MIDI access was blocked or denied. Notes and knobs still work from the mouse/keyboard."));
  }

  WF.Midi = { init };
  init();
})();
