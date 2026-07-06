/* wubflipz — workflow continuity layer
 * Reads existing app state and coordinates UX feedback only. No DSP/audio driving.
 */
(function () {
  "use strict";
  const WF = (window.WF = window.WF || {});
  const $ = (id) => document.getElementById(id);
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SOUND_LABELS = new Set([
    "Detune", "Mix A/B", "oscA", "oscB", "wobbleWave", "growlWave", "Keyboard Octave",
    "Sub Octave", "Wobble", "Sub", "Half-Time", "Wobble BPM", "Wobble Division",
    "Sub Level", "Cutoff", "Reso", "Depth", "Amount", "Rate", "Attack", "Decay",
    "Sustain", "Release", "Drive", "Master", "Preset Name",
  ]);
  let heardKeys = false, designTouched = false, soundDirty = false, sessionDirty = false;
  let toastTimer = 0, tipTimer = 0, nextTimer = 0, laneTimer = 0, tipEl = null;
  let statusTarget = "";

  function sampleLoaded() { return !!(WF.Player && WF.Player.buffer); }
  function analysisDone() {
    const bpm = $("detBpm"), key = $("detKey");
    return !!((bpm && bpm.value) || (key && key.value && key.value !== "—"));
  }
  function trackCount() {
    return WF.Tracks && Array.isArray(WF.Tracks.list) ? WF.Tracks.list.length : 0;
  }
  function stemCount() {
    return WF.Tracks && Array.isArray(WF.Tracks.list) ? WF.Tracks.list.filter((t) => t.kind !== "original").length : 0;
  }
  function lanesReady() { return trackCount() > 0 || !!(WF.Lanes && Array.isArray(WF.Lanes.lanes) && WF.Lanes.lanes.length); }
  function presetReady() { const name = $("presetName"); return !!(name && name.value && name.value.trim()); }
  function sessionSaved() {
    try { return !!localStorage.getItem("wubflipz.project.active.v1") && !sessionDirty; }
    catch (e) { return !sessionDirty; }
  }
  function timeNow() { return new Date().toLocaleTimeString(); }

  function setStatus(title, detail, tone) {
    const box = $("statusCenter"), h = $("globalStatusTitle"), d = $("globalStatusDetail"), t = $("globalStatusTime");
    if (!box || !h || !d) return;
    box.classList.remove("ok", "warn", "fail");
    box.classList.add(tone || "ok");
    h.textContent = title || "Ready";
    d.textContent = detail || "";
    if (t) t.textContent = timeNow();
  }
  function setAction(label, target) {
    const b = $("statusAction");
    if (!b) return;
    statusTarget = target || "";
    b.textContent = label || "Next";
    b.hidden = !statusTarget;
  }
  function showToast(message, detail, tone) {
    const el = $("uxToast");
    if (message) setStatus(message, detail, tone);
    if (!el || !message) return;
    el.textContent = detail ? `${message}: ${detail}` : message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
  }
  function suggest(title, detail, target) {
    setStatus(title, detail, "ok");
    setAction(actionLabel(title, target), target);
    clearTimeout(nextTimer);
    nextTimer = setTimeout(() => {
      if (sessionDirty) setStatus("Session Modified", "Save session when ready.");
      else if (soundDirty) setStatus("Sound Modified", "Save sound when ready.");
      else setStatus("Ready", "Continue creating.");
    }, 4200);
    if (target) highlight(target);
  }
  function highlight(id) {
    const el = $(id);
    if (!el) return;
    el.classList.add("highlight-next");
    clearTimeout(laneTimer);
    laneTimer = setTimeout(() => el.classList.remove("highlight-next"), 1800);
  }

  function markDirty(scope) {
    if (scope === "sound" || scope === "all") soundDirty = true;
    if (scope === "session" || scope === "all") sessionDirty = true;
    if (scope === "sound" || scope === "all") designTouched = true;
    renderDirty();
    updateWorkflow();
  }
  function clearDirty(scope) {
    if (scope === "sound" || scope === "all") soundDirty = false;
    if (scope === "session" || scope === "all") sessionDirty = false;
    renderDirty();
    updateWorkflow();
  }
  function renderDirty() {
    const sound = $("soundDirty"), session = $("sessionDirty");
    if (sound) {
      sound.textContent = soundDirty ? "● Sound Modified" : "Sound Saved";
      sound.classList.toggle("modified", soundDirty);
    }
    if (session) {
      session.textContent = sessionDirty ? "● Session Modified" : "Session Saved";
      const wrap = session.closest(".save-semantics");
      if (wrap) wrap.classList.toggle("modified", sessionDirty);
    }
  }

  function stageState(key) {
    if (key === "preset") return presetReady() ? ["complete", "Sound ready."] : ["ready", "Choose a factory or user sound."];
    if (key === "keys") return heardKeys ? ["complete", "Keyboard played."] : ["ready", "Press A S D F or click the keyboard."];
    if (key === "design") {
      if (!heardKeys) return ["blocked", "Play the sound first."];
      if (soundDirty) return ["ready", "Designing sound. Save when ready."];
      return designTouched ? ["complete", "Sound design saved."] : ["ready", "Adjust Wobble, Growl, Filter, or Drive."];
    }
    if (key === "sample") return sampleLoaded() ? ["complete", "Sample loaded."] : ["ready", "Drop or browse an audio file."];
    if (key === "analyze") return sampleLoaded() ? (analysisDone() ? ["complete", "Analysis complete."] : ["ready", "Ready to analyze sample."]) : ["blocked", "Load sample first."];
    if (key === "split") return sampleLoaded() ? (stemCount() > 0 ? ["complete", `${stemCount()} stems ready.`] : ["ready", "Ready to split loaded sample."]) : ["blocked", "Load sample first."];
    if (key === "arrange") return lanesReady() ? ["complete", "Tracks ready in Lanes."] : ["blocked", "Load or split audio first."];
    if (key === "save") return sessionSaved() ? ["complete", "Session saved."] : ["ready", "Save session or share current preset."];
    return ["ready", ""];
  }
  function currentStage(states) {
    const order = ["preset", "keys", "design", "sample", "analyze", "split", "arrange", "save"];
    return order.find((k) => states[k] && states[k][0] === "ready") || order.find((k) => states[k] && states[k][0] === "blocked") || "save";
  }
  function updateWorkflow() {
    const states = {};
    document.querySelectorAll("#workflowStrip [data-step]").forEach((button) => {
      states[button.dataset.step] = stageState(button.dataset.step);
    });
    const cur = currentStage(states);
    document.querySelectorAll("#workflowStrip [data-step]").forEach((button) => {
      const [state, reason] = states[button.dataset.step] || ["ready", ""];
      button.classList.remove("done", "current", "blocked", "ready", "active");
      button.classList.add(state === "complete" ? "done" : state);
      button.classList.toggle("current", button.dataset.step === cur);
      button.classList.toggle("active", button.dataset.step === cur && state === "ready");
      button.setAttribute("aria-current", button.dataset.step === cur ? "step" : "false");
      button.dataset.tip = reason;
      button.title = reason;
      const marker = button.querySelector("span");
      const label = button.querySelector("em");
      if (marker) {
        if (!button.dataset.index) button.dataset.index = marker.textContent.replace(/\D/g, "") || "?";
        marker.textContent = state === "complete" ? "✓" : state === "blocked" ? "!" : button.dataset.step === cur ? "▶" : button.dataset.index;
      }
      if (label) label.textContent = state.toUpperCase();
    });
    updateGates();
    updateLanes();
    updateEmphasis(cur);
  }
  function updateGates() {
    const noSample = !sampleLoaded();
    [["detectBtn", "Load a sample first."], ["splitHP", "Load a sample first."], ["splitMS", "Load a sample first."], ["matchWobbleBtn", "Load a sample first."]].forEach(([id, why]) => {
      const b = $(id);
      if (!b) return;
      b.disabled = noSample;
      b.setAttribute("aria-disabled", noSample ? "true" : "false");
      b.title = noSample ? why : "";
      b.dataset.tip = noSample ? why : (b.dataset.tip || "");
    });
    const sampleNext = $("sampleNext");
    if (sampleNext) sampleNext.textContent = noSample ? "Load audio to unlock Analyze and Split." : "Sample ready. Analyze sample next.";
  }
  function updateLanes() {
    const empty = $("lanesEmpty"), guide = $("laneGuide"), text = $("laneGuideText");
    const count = stemCount();
    if (empty) empty.hidden = trackCount() > 0;
    if (guide && text) {
      guide.hidden = count <= 0;
      text.textContent = count > 0 ? `${count} stems added to Lanes. Ready to arrange.` : "Ready to arrange.";
    }
  }

  function scrollToTarget(button) {
    const state = stageState(button.dataset.step);
    if (state[0] === "blocked") {
      showToast(`${button.querySelector("b").textContent} Blocked`, state[1], "warn");
      return;
    }
    const target = $(button.dataset.target);
    if (target) target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }
  function confirmDirty(action) {
    if (!soundDirty && !sessionDirty) return true;
    const bits = [];
    if (soundDirty) bits.push("sound changes");
    if (sessionDirty) bits.push("session changes");
    return window.confirm(`${action} may replace unsaved ${bits.join(" and ")}. Continue?`);
  }
  function actionLabel(title, target) {
    if (target === "detectBtn") return "Analyze";
    if (target === "quickSplitBoard" || target === "splitHP") return "Split Sample";
    if (target === "lanesBoard") return "Open Lanes";
    if (target === "projectBoard" || target === "projectSave") return "Save Session";
    if (target === "presetSave") return "Save Sound";
    if (target === "auditionStrip" || target === "keys") return "Play Keys";
    if (target === "playerBoard") return "Open Sample";
    return title && title.includes("Save") ? "Continue" : "Next";
  }
  function runStatusAction() {
    if (!statusTarget) return;
    const target = $(statusTarget);
    if (!target) return;
    if (target.matches && target.matches("button:not(:disabled)")) target.click();
    else target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }
  function audition(key) {
    window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    setTimeout(() => window.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true })), 420);
  }
  function moduleByKey(key) {
    const labels = { filter: "Filter", wobble: "Wobble", growl: "Growl", out: "Drive and output" };
    return labels[key] ? document.querySelector(`.module[aria-label="${labels[key]}"]`) : $(key);
  }
  function updateEmphasis(current) {
    const map = {
      sample: ["playerBoard"],
      analyze: ["analyzeBoard"],
      split: ["quickSplitBoard"],
      arrange: ["lanesBoard", "seqBoard"],
      save: ["projectBoard"],
      design: ["wobble", "growl", "filter", "out"],
    };
    document.querySelectorAll(".workflow-focus,.workflow-muted").forEach((el) => el.classList.remove("workflow-focus", "workflow-muted"));
    (map[current] || []).forEach((id) => { const el = moduleByKey(id); if (el) el.classList.add("workflow-focus"); });
    if (!sampleLoaded()) ["analyzeBoard", "quickSplitBoard"].forEach((id) => { const el = $(id); if (el) el.classList.add("workflow-muted"); });
    const active = !!(WF.Engine && WF.Engine.voiceCount && WF.Engine.voiceCount() > 0) || !!(WF.Player && WF.Player.playing) || !!(WF.Lanes && WF.Lanes.playing) || !!(WF.Sequencer && WF.Sequencer.playing);
    document.body.classList.toggle("audio-active", active);
  }
  function showContinueSession() {
    const box = $("continueSession"), meta = $("continueSessionMeta");
    if (!box) return;
    let has = false, label = "Last saved recently.";
    try {
      const projects = JSON.parse(localStorage.getItem("wubflipz.projects.v1") || "[]");
      has = Array.isArray(projects) && projects.length > 0;
      if (has && projects[0].savedAt) label = `Last saved ${new Date(projects[0].savedAt).toLocaleString()}`;
    } catch (e) {}
    box.hidden = !has;
    if (meta) meta.textContent = label;
  }

  function ensureTip() {
    if (tipEl) return tipEl;
    tipEl = document.createElement("div");
    tipEl.className = "wf-tooltip";
    tipEl.setAttribute("role", "tooltip");
    document.body.appendChild(tipEl);
    return tipEl;
  }
  function showTip(target) {
    const text = target && target.dataset ? target.dataset.tip : "";
    if (!text) return;
    const tip = ensureTip();
    tip.textContent = text;
    const r = target.getBoundingClientRect();
    tip.style.left = `${Math.min(window.innerWidth - 280, Math.max(12, r.left))}px`;
    tip.style.top = `${Math.min(window.innerHeight - 80, r.bottom + 8)}px`;
    tip.classList.add("show");
  }
  function hideTip() { clearTimeout(tipTimer); if (tipEl) tipEl.classList.remove("show"); }
  function armTip(target) { clearTimeout(tipTimer); tipTimer = setTimeout(() => showTip(target), 520); }

  function bind() {
    document.querySelectorAll("#workflowStrip [data-step]").forEach((button) => button.addEventListener("click", () => scrollToTarget(button)));
    if ($("statusAction")) $("statusAction").addEventListener("click", runStatusAction);
    document.querySelectorAll("#auditionStrip [data-key]").forEach((b) => b.addEventListener("click", () => audition(b.dataset.key)));
    if ($("resumeSession")) $("resumeSession").addEventListener("click", () => {
      const r = $("recentProjects");
      if (r && r.value) r.dispatchEvent(new Event("change"));
      else if ($("projectRecover")) $("projectRecover").click();
    });
    if ($("openRecentSession")) $("openRecentSession").addEventListener("click", () => {
      if ($("projectExpand") && $("projectExpand").getAttribute("aria-expanded") !== "true") $("projectExpand").click();
      const r = $("recentProjects"); if (r) r.focus();
    });
    if ($("newSessionQuick")) $("newSessionQuick").addEventListener("click", () => { if ($("projectNew")) $("projectNew").click(); });
    const openLanes = $("openLanesBtn");
    if (openLanes) openLanes.addEventListener("click", () => { const lanes = $("lanesBoard"); if (lanes) lanes.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" }); });
    window.addEventListener("wf:toast", (e) => showToast(e.detail && e.detail.message, e.detail && e.detail.detail, e.detail && e.detail.tone));
    window.addEventListener("wf:status", (e) => setStatus(e.detail && e.detail.title, e.detail && e.detail.detail, e.detail && e.detail.tone));
    window.addEventListener("wf:next-step", (e) => suggest(e.detail && e.detail.title, e.detail && e.detail.detail, e.detail && e.detail.target));
    window.addEventListener("wf:dirty-clear", (e) => clearDirty((e.detail && e.detail.scope) || "all"));
    window.addEventListener("wf:sample-loaded", () => { markDirty("session"); updateWorkflow(); });
    window.addEventListener("wf:analysis-complete", () => { markDirty("session"); updateWorkflow(); });
    window.addEventListener("wf:split-complete", (e) => {
      markDirty("session");
      updateWorkflow();
      highlight("lanesBoard");
      const count = e.detail && e.detail.count ? e.detail.count : stemCount();
      showToast("Split Complete", `${count} stems added to Lanes.`);
    });
    window.addEventListener("wf:workflow-update", updateWorkflow);
    window.addEventListener("wf:emergency-stop", () => { heardKeys = false; updateWorkflow(); });
    window.addEventListener("wf:edit", (e) => {
      const label = e.detail && e.detail.label;
      markDirty(SOUND_LABELS.has(label) ? "all" : "session");
      if (label && SOUND_LABELS.has(label)) suggest("Sound Modified", "Save sound when ready.", "presetSave");
      else setStatus("Session Modified", "Save session when ready.");
    });
    const oldOn = WF.Engine && WF.Engine._onNoteOn;
    if (WF.Engine) {
      WF.Engine._onNoteOn = (midi) => {
        heardKeys = true;
        if (oldOn) oldOn(midi);
        suggest("Ready to Design", "Adjust Wobble, Growl, Filter, or Drive.", "wobble");
        updateWorkflow();
      };
    }
    document.addEventListener("input", (e) => {
      if (e.target.closest("#projectBoard")) markDirty("session");
      else if (e.target.closest("#presetBrowser") && e.target.id !== "presetName") {
        updateWorkflow();
        return;
      } else if (e.target.closest(".module")) markDirty("all");
      updateWorkflow();
    }, true);
    document.addEventListener("change", (e) => {
      if (e.target.id === "recentProjects" && !confirmDirty("Loading a recent session")) { e.preventDefault(); e.stopImmediatePropagation(); return; }
      if (e.target.closest("#projectBoard")) markDirty("session");
      else if (e.target.closest("#seqBoard") || e.target.closest("#playerBoard") || e.target.closest("#quickSplitBoard")) markDirty("session");
      updateWorkflow();
    }, true);
    document.addEventListener("click", (e) => {
      const id = e.target && e.target.id;
      const destructive = {
        projectNew: "Starting a new session",
        projectLoad: "Loading a session",
        projectRecover: "Recovering autosave",
        presetLoad: "Loading a sound",
        presetLoadSelected: "Loading a sound",
      };
      if (destructive[id] && !confirmDirty(destructive[id])) { e.preventDefault(); e.stopImmediatePropagation(); return; }
      updateWorkflow();
    }, true);
    document.addEventListener("pointerenter", (e) => { const target = e.target.closest && e.target.closest("[data-tip]"); if (target) armTip(target); }, true);
    document.addEventListener("pointerleave", (e) => { if (e.target.closest && e.target.closest("[data-tip]")) hideTip(); }, true);
    document.addEventListener("focusin", (e) => { const target = e.target.closest && e.target.closest("[data-tip]"); if (target) armTip(target); });
    document.addEventListener("focusout", hideTip);
    renderDirty();
    updateWorkflow();
    if (presetReady()) { setStatus("Default Sound Loaded", "Press A S D F or click the keyboard to audition."); setAction("Play Keys", "auditionStrip"); }
    showContinueSession();
    if (WF.Viz) WF.Viz.register("ux-emphasis", () => {
      const states = {};
      document.querySelectorAll("#workflowStrip [data-step]").forEach((button) => (states[button.dataset.step] = stageState(button.dataset.step)));
      updateEmphasis(currentStage(states));
    });
  }

  WF.UX = { updateWorkflow, toast: showToast, status: setStatus, dirty: () => ({ soundDirty, sessionDirty }) };
  bind();
})();
