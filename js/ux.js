/* wubflipz — UX Sprint 1 glue
 * Workflow orientation, lightweight tooltips, and toast feedback only.
 * This module reads existing app state; it does not drive audio or DSP.
 */
(function () {
  "use strict";
  const WF = (window.WF = window.WF || {});
  const $ = (id) => document.getElementById(id);
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let heardKeys = false, toastTimer = 0, tipTimer = 0, tipEl = null;

  function sampleLoaded() {
    return !!(WF.Player && WF.Player.buffer);
  }
  function analysisDone() {
    const bpm = $("detBpm");
    const key = $("detKey");
    return !!((bpm && bpm.value) || (key && key.value));
  }
  function splitDone() {
    return !!(WF.Tracks && Array.isArray(WF.Tracks.list) && WF.Tracks.list.length);
  }
  function lanesReady() {
    return splitDone() || !!(WF.Lanes && Array.isArray(WF.Lanes.lanes) && WF.Lanes.lanes.length);
  }
  function presetReady() {
    const name = $("presetName");
    return !!(name && name.value && name.value.trim());
  }
  function projectSaved() {
    try { return !!localStorage.getItem("wubflipz.projects.v1"); }
    catch (e) { return false; }
  }

  const steps = [
    { key: "preset", done: presetReady },
    { key: "keys", done: () => heardKeys },
    { key: "sample", done: sampleLoaded },
    { key: "analyze", done: analysisDone },
    { key: "split", done: splitDone },
    { key: "arrange", done: lanesReady },
    { key: "export", done: projectSaved },
  ];

  function updateWorkflow() {
    const buttons = document.querySelectorAll("#workflowStrip [data-step]");
    if (!buttons.length) return;
    let current = steps.findIndex((s) => !s.done());
    if (current < 0) current = steps.length - 1;
    buttons.forEach((button, i) => {
      const done = i < current || steps[i].done();
      const active = i === current;
      button.classList.toggle("done", done && !active);
      button.classList.toggle("current", active);
      button.setAttribute("aria-current", active ? "step" : "false");
      const marker = button.querySelector("span");
      if (marker) marker.textContent = done && !active ? "✓" : String(i + 1);
    });
  }

  function scrollToTarget(button) {
    const id = button.dataset.target;
    const target = id ? $(id) : null;
    if (!target) return;
    target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }

  function showToast(message) {
    const el = $("uxToast");
    if (!el || !message) return;
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
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
    const left = Math.min(window.innerWidth - 280, Math.max(12, r.left));
    const top = Math.min(window.innerHeight - 80, r.bottom + 8);
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
    tip.classList.add("show");
  }
  function hideTip() {
    clearTimeout(tipTimer);
    if (tipEl) tipEl.classList.remove("show");
  }
  function armTip(target) {
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => showTip(target), 520);
  }

  function bind() {
    document.querySelectorAll("#workflowStrip [data-step]").forEach((button) => {
      button.addEventListener("click", () => scrollToTarget(button));
    });
    window.addEventListener("wf:toast", (e) => showToast(e.detail && e.detail.message));
    window.addEventListener("wf:workflow-update", updateWorkflow);
    window.addEventListener("wf:emergency-stop", () => {
      heardKeys = false;
      updateWorkflow();
    });
    const oldOn = WF.Engine && WF.Engine._onNoteOn;
    if (WF.Engine) {
      WF.Engine._onNoteOn = (midi) => {
        heardKeys = true;
        if (oldOn) oldOn(midi);
        updateWorkflow();
      };
    }
    document.addEventListener("input", updateWorkflow, true);
    document.addEventListener("change", updateWorkflow, true);
    document.addEventListener("click", updateWorkflow, true);
    document.addEventListener("pointerenter", (e) => {
      const target = e.target.closest && e.target.closest("[data-tip]");
      if (target) armTip(target);
    }, true);
    document.addEventListener("pointerleave", (e) => {
      if (e.target.closest && e.target.closest("[data-tip]")) hideTip();
    }, true);
    document.addEventListener("focusin", (e) => {
      const target = e.target.closest && e.target.closest("[data-tip]");
      if (target) armTip(target);
    });
    document.addEventListener("focusout", hideTip);
    updateWorkflow();
  }

  WF.UX = { updateWorkflow, toast: showToast };
  bind();
})();
