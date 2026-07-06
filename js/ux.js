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
    return !!(WF.Project && WF.Project.hasActiveSession && WF.Project.hasActiveSession()) && !sessionDirty;
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
    updateStepperHeads(states);
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
    // soft focus, not a hard gate: blocked stages still expand so their own
    // "Load sample first" guidance is visible; the toast repeats the reason
    if (state[0] === "blocked") showToast(`${button.querySelector("b").textContent} Blocked`, state[1], "warn");
    const target = resolveTarget(button.dataset.target);
    if (!target) return;
    revealTarget(target);
    target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
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
    const target = resolveTarget(statusTarget);
    if (!target) return;
    // a target inside a collapsed stage must be expanded (and brought into
    // view) before it is clicked or scrolled to
    const expanded = revealTarget(target);
    if (target.matches && target.matches("button:not(:disabled)")) {
      if (expanded) target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      target.click();
    } else target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
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
    const latest = WF.Project && WF.Project.latestProjectMeta ? WF.Project.latestProjectMeta() : null;
    const has = !!latest;
    box.hidden = !has;
    if (meta) meta.textContent = has && latest.savedAt ? `Last saved ${new Date(latest.savedAt).toLocaleString()}` : "Last saved recently.";
  }

  // ---- Sprint 4a: soft-focus stepper ----------------------------------------
  // The workflow strip is the navigator: exactly one stage expanded at a time,
  // all other stages collapsed to a clickable header row (stage name + state
  // badge reusing the strip's READY/COMPLETE/BLOCKED logic). Headers and
  // wrappers are created here at runtime so the no-JS default DOM renders
  // fully expanded (progressive enhancement). Collapsed stages stay in the
  // DOM — grid 0fr + inert + aria-hidden, the existing project-expanded
  // disclosure pattern — and expand/collapse is instant show/hide, which also
  // satisfies prefers-reduced-motion. Soft focus, never a hard gate: BLOCKED
  // stages still expand and show their own "Load sample first" guidance.
  // The Advanced zone is deliberately outside the stepper (always accessible).
  const STAGE_DEFS = [
    { key: "design", label: "Design", strip: ["preset", "keys", "design"], find: () => [document.querySelector(".rack"), document.querySelector(".kbwrap")] },
    { key: "sample", label: "Sample", strip: ["sample"], find: () => [$("playerBoard")] },
    { key: "analyze", label: "Analyze", strip: ["analyze"], find: () => [$("analyzeBoard")] },
    { key: "split", label: "Split", strip: ["split"], find: () => [$("quickSplitBoard")] },
    { key: "arrange", label: "Arrange", strip: ["arrange"], find: () => [$("seqBoard"), $("lanesBoard")] },
    { key: "save", label: "Save / Share", strip: ["save"], find: () => [$("projectBoard")] },
  ];
  const stepperStages = [];
  let activeStage = "";

  function buildStepper() {
    STAGE_DEFS.forEach((def) => {
      const els = def.find().filter(Boolean);
      if (!els.length) return;
      const head = document.createElement("button");
      head.type = "button";
      head.className = "stage-head";
      head.setAttribute("aria-expanded", "true");
      head.setAttribute("aria-controls", `stageBody-${def.key}`);
      const name = document.createElement("b");
      name.textContent = def.label;
      const badge = document.createElement("em");
      badge.className = "stage-state";
      badge.textContent = "READY";
      head.append(name, badge);
      const body = document.createElement("div");
      body.className = "stage-body";
      body.id = `stageBody-${def.key}`;
      const inner = document.createElement("div");
      inner.className = "stage-inner";
      body.appendChild(inner);
      els[0].parentNode.insertBefore(head, els[0]);
      els[0].parentNode.insertBefore(body, els[0]);
      els.forEach((el) => inner.appendChild(el));
      head.addEventListener("click", () => {
        expandStage(def.key);
        head.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      });
      stepperStages.push({ key: def.key, label: def.label, strip: def.strip, head, badge, body, inner });
    });
  }
  function expandStage(key) {
    let opened = false;
    stepperStages.forEach((s) => {
      const on = s.key === key;
      if (on && s.body.classList.contains("stage-collapsed")) opened = true;
      s.head.setAttribute("aria-expanded", on ? "true" : "false");
      s.body.classList.toggle("stage-collapsed", !on);
      if (on) { s.body.removeAttribute("inert"); s.body.removeAttribute("aria-hidden"); }
      else { s.body.setAttribute("inert", ""); s.body.setAttribute("aria-hidden", "true"); }
    });
    activeStage = key;
    // canvases inside a collapsed stage laid out at zero size; env/waveform/lanes
    // already redraw on resize, so a synthetic resize repaints the opened stage
    if (opened) window.dispatchEvent(new Event("resize"));
  }
  function stageContaining(el) {
    return stepperStages.find((s) => s.inner.contains(el)) || null;
  }
  function revealTarget(el) {
    const stage = stageContaining(el);
    const wasCollapsed = !!(stage && stage.key !== activeStage);
    if (wasCollapsed) expandStage(stage.key);
    return wasCollapsed;
  }
  function resolveTarget(id) { return $(id) || moduleByKey(id); }
  function stageKeyForStep(step) {
    const stage = stepperStages.find((s) => s.strip.includes(step));
    return stage ? stage.key : "";
  }
  function updateStepperHeads(states) {
    stepperStages.forEach((s) => {
      const subs = s.strip.map((k) => (states[k] ? states[k][0] : "ready"));
      // multi-step stages (Design) are never badge-blocked: the panel itself
      // holds the keyboard/preset browser the sub-step blockers point at
      const state = subs.every((x) => x === "complete") ? "complete"
        : (s.strip.length === 1 && subs[0] === "blocked") ? "blocked"
        : "ready";
      s.badge.textContent = state.toUpperCase();
      s.badge.classList.toggle("done", state === "complete");
      s.badge.classList.toggle("blocked", state === "blocked");
    });
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
    if (openLanes) openLanes.addEventListener("click", () => { const lanes = $("lanesBoard"); if (lanes) { revealTarget(lanes); lanes.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" }); } });
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
    buildStepper();
    renderDirty();
    updateWorkflow();
    // initial soft focus: expand the stage that holds the current workflow step
    const initStates = {};
    document.querySelectorAll("#workflowStrip [data-step]").forEach((b) => (initStates[b.dataset.step] = stageState(b.dataset.step)));
    const initKey = stageKeyForStep(currentStage(initStates));
    if (initKey) expandStage(initKey);
    if (presetReady()) { setStatus("Default Sound Loaded", "Press A S D F or click the keyboard to audition."); setAction("Play Keys", "auditionStrip"); }
    showContinueSession();
    window.addEventListener("wf:projects-ready", showContinueSession);
    if (WF.Viz) WF.Viz.register("ux-emphasis", () => {
      const states = {};
      document.querySelectorAll("#workflowStrip [data-step]").forEach((button) => (states[button.dataset.step] = stageState(button.dataset.step)));
      updateEmphasis(currentStage(states));
    });
  }

  WF.UX = { updateWorkflow, toast: showToast, status: setStatus, dirty: () => ({ soundDirty, sessionDirty }) };
  bind();
})();
