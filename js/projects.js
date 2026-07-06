/* wubflipz — project/session management
 * Workflow state only: projects, autosave, undo/redo, layouts, panel visibility,
 * snapshots, recents, and sample manifests. Audio files are referenced, not embedded.
 */
(function () {
  "use strict";
  const WF = (window.WF = window.WF || {});
  const $ = (id) => document.getElementById(id);
  const LS_PROJECTS = "wubflipz.projects.v1";
  const LS_ACTIVE = "wubflipz.project.active.v1";
  const LS_AUTOSAVE = "wubflipz.project.autosave.v1";
  const LS_WORKSPACES = "wubflipz.workspaces.v1";
  const LS_RECENTS = "wubflipz.project.recents.v1";
  const HISTORY_MAX = 40;
  const PANELS = [
    ["projectBoard", "Project"], ["playerBoard", "Sample"], ["fuzzerBoard", "Fuzzer"],
    ["analyzeBoard", "Analyze"], ["quickSplitBoard", "Quick Split"], ["seqBoard", "Sequencer"],
    ["lanesBoard", "Lanes"], ["osc", "Oscillators"], ["sub", "Sub"], ["filter", "Filter"],
    ["wobble", "Wobble"], ["growl", "Growl"], ["env", "Envelope"], ["out", "Drive/Out"], ["presets", "Presets"],
  ];
  const MODULE_LABELS = ["osc", "sub", "filter", "wobble", "growl", "env", "out", "presets"];
  let undoStack = [], redoStack = [], applying = false, saveTimer = 0, historyTimer = 0;

  function read(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) {
      // storage failures must never be silent (fix-s1): callers also surface via status()
      console.error("wubflipz: storage write failed for", key, "—", e && e.name ? e.name : e);
      return false;
    }
  }
  // LS_ACTIVE holds a bare id string written with raw setItem; reading it through
  // read()/JSON.parse always threw and returned "", which minted a fresh project id
  // on every capture — the real cause of unbounded project-list growth (fix-s1).
  function activeId() {
    try { return localStorage.getItem(LS_ACTIVE) || ""; } catch (e) { return ""; }
  }
  function nowIso() { return new Date().toISOString(); }
  function id(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`; }
  function status(msg) { const el = $("projectStatus"); if (el) el.textContent = msg; }
  function projects() { const p = read(LS_PROJECTS, []); return Array.isArray(p) ? p : []; }
  function saveProjects(list) { return write(LS_PROJECTS, list); }
  function recents() { const r = read(LS_RECENTS, []); return Array.isArray(r) ? r : []; }
  function markRecent(projectId) { write(LS_RECENTS, [projectId].concat(recents().filter((x) => x !== projectId)).slice(0, 10)); }
  function moduleForKey(key) { return document.querySelector(`.module[aria-label="${key}"]`); }
  function panelElement(key) {
    if (key === "osc") return moduleForKey("Oscillators");
    if (key === "sub") return moduleForKey("Sub bass");
    if (key === "filter") return moduleForKey("Filter");
    if (key === "wobble") return moduleForKey("Wobble");
    if (key === "growl") return moduleForKey("Growl");
    if (key === "env") return moduleForKey("Envelope");
    if (key === "out") return moduleForKey("Drive and output");
    if (key === "presets") return moduleForKey("Presets");
    return $(key);
  }
  function metadataFromUI() {
    return {
      name: $("projectName").value || "Untitled Project",
      author: $("projectAuthor").value || "User",
      genre: $("projectGenre").value || "Dubstep",
      key: $("projectKey").value || "—",
      bpm: parseFloat($("projectBpm").value) || (WF.state && WF.state.bpm) || 140,
      notes: $("projectNotes").value || "",
    };
  }
  function applyMetadata(meta) {
    meta = meta || {};
    $("projectName").value = meta.name || "Untitled Project";
    $("projectAuthor").value = meta.author || "User";
    $("projectGenre").value = meta.genre || "Dubstep";
    $("projectKey").value = meta.key || "—";
    $("projectBpm").value = Math.round(meta.bpm || (WF.state && WF.state.bpm) || 140);
    $("projectNotes").value = meta.notes || "";
  }
  function sampleManifest() {
    const out = [];
    if (WF.Player && WF.Player.buffer) {
      out.push({
        role: "Sample",
        name: $("fileName") ? $("fileName").textContent : "Loaded sample",
        duration: WF.Player.duration || WF.Player.buffer.duration,
        channels: WF.Player.buffer.numberOfChannels,
        sampleRate: WF.Player.buffer.sampleRate,
      });
    }
    if (WF.Tracks && Array.isArray(WF.Tracks.list)) {
      WF.Tracks.list.forEach((t) => out.push({
        role: "Track",
        name: t.name,
        kind: t.kind,
        duration: t.buffer ? t.buffer.duration : 0,
        channels: t.buffer ? t.buffer.numberOfChannels : 0,
        sampleRate: t.buffer ? t.buffer.sampleRate : 0,
      }));
    }
    if (WF.Sequencer && Array.isArray(WF.Sequencer.pads)) {
      WF.Sequencer.pads.forEach((p) => { if (p.sampleName) out.push({ role: "Pad", name: p.sampleName, duration: p.sample ? p.sample.duration : 0, pad: p.name }); });
    }
    return out;
  }
  function captureLayout() {
    const hidden = {};
    const sizes = {};
    PANELS.forEach(([key]) => {
      const el = panelElement(key);
      if (!el) return;
      hidden[key] = el.classList.contains("dock-hidden");
      if (el.style.height) sizes[key] = el.style.height;
    });
    return { layout: document.body.dataset.layout || "Studio", hidden, sizes };
  }
  function applyLayout(data) {
    data = data || {};
    document.body.dataset.layout = data.layout || "Studio";
    $("layoutSelect").value = data.layout || "Studio";
    PANELS.forEach(([key]) => {
      const el = panelElement(key);
      if (!el) return;
      el.classList.toggle("dock-hidden", !!(data.hidden && data.hidden[key]));
      if (data.sizes && data.sizes[key]) el.style.height = data.sizes[key];
    });
    renderDockList();
  }
  function captureProject(name) {
    const meta = metadataFromUI();
    if (name) meta.name = name;
    // Captured state deliberately contains NO snapshot list: snapshots live only on
    // the stored project entry. Embedding them here made every snapshot's state
    // include all prior snapshots recursively — exponential serialized growth
    // (AUDIT_REPORT_2026-07-05 finding #1; fix-s1).
    return {
      app: "wubflipz",
      version: 1,
      id: activeId() || id("project"),
      savedAt: nowIso(),
      metadata: meta,
      preset: WF.Presets && WF.Presets.capture ? WF.Presets.capture(meta.name) : null,
      layout: captureLayout(),
      samples: sampleManifest(),
    };
  }
  function currentProjectSnapshots() {
    const active = activeId();
    const p = projects().find((x) => x.id === active);
    return p && Array.isArray(p.snapshots) ? p.snapshots : [];
  }
  function applyProject(project, opts) {
    if (!project) return false;
    applying = true;
    try {
      localStorage.setItem(LS_ACTIVE, project.id);
      applyMetadata(project.metadata);
      if (project.preset && WF.Presets && WF.Presets.apply) WF.Presets.apply(project.preset);
      applyLayout(project.layout);
      markRecent(project.id);
      renderAll();
      if (!opts || !opts.noHistory) pushHistory("load");
      status(`loaded ${project.metadata && project.metadata.name ? project.metadata.name : "project"}`);
      return true;
    } finally { applying = false; }
  }
  function saveProject() {
    const p = captureProject();
    const list = projects();
    const i = list.findIndex((x) => x.id === p.id);
    // snapshots are preserved from the stored entry (captured state excludes them)
    p.snapshots = i >= 0 && Array.isArray(list[i].snapshots) ? list[i].snapshots : [];
    if (i >= 0) list[i] = p; else list.unshift(p);
    if (!saveProjects(list)) { status("project save FAILED — storage full?"); return p; }
    localStorage.setItem(LS_ACTIVE, p.id); markRecent(p.id);
    renderAll(); status("project saved");
    return p;
  }
  function newProject() {
    localStorage.setItem(LS_ACTIVE, id("project"));
    applyMetadata({ name: "Untitled Project", author: "User", genre: "Dubstep", key: "—", bpm: WF.state ? WF.state.bpm : 140, notes: "" });
    pushHistory("new"); scheduleAutosave(); renderAll(); status("new project");
  }
  function saveSnapshot() {
    const p = saveProject();
    const snap = { id: id("snapshot"), name: `${p.metadata.name} ${new Date().toLocaleTimeString()}`, savedAt: nowIso(), state: captureProject(p.metadata.name) };
    const list = projects();
    const i = list.findIndex((x) => x.id === p.id);
    if (i >= 0) {
      // flat, capped history: independent entries, oldest evicted past 20 (fix-s1)
      list[i].snapshots = [snap].concat(list[i].snapshots || []).slice(0, 20);
      if (!saveProjects(list)) { status("snapshot save FAILED — storage full?"); return; }
    }
    renderSnapshots(list[i] ? list[i].snapshots : [snap]); status("snapshot saved");
  }
  function pushHistory(reason) {
    if (applying) return;
    const snap = captureProject();
    snap.reason = reason || "edit";
    undoStack.push(snap);
    if (undoStack.length > HISTORY_MAX) undoStack.shift();
    redoStack = [];
    updateUndoButtons();
  }
  function undo() {
    if (undoStack.length < 2) return;
    const cur = undoStack.pop();
    redoStack.push(cur);
    applyProject(undoStack[undoStack.length - 1], { noHistory: true });
    updateUndoButtons(); status("undo");
  }
  function redo() {
    const next = redoStack.pop();
    if (!next) return;
    undoStack.push(next);
    applyProject(next, { noHistory: true });
    updateUndoButtons(); status("redo");
  }
  function updateUndoButtons() {
    $("projectUndo").classList.toggle("on", undoStack.length > 1);
    $("projectRedo").classList.toggle("on", redoStack.length > 0);
  }
  function scheduleAutosave() {
    if (applying) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const p = captureProject();
      p.autosavedAt = nowIso();
      if (write(LS_AUTOSAVE, p)) status(`autosaved ${new Date().toLocaleTimeString()}`);
      else status("autosave FAILED — storage full?");
    }, 1200);
  }
  function scheduleHistory(reason) {
    if (applying) return;
    clearTimeout(historyTimer);
    historyTimer = setTimeout(() => { pushHistory(reason); scheduleAutosave(); }, 300);
  }
  function recoverAutosave() {
    const p = read(LS_AUTOSAVE, null);
    if (!p) return status("no autosave found");
    applyProject(p); status("autosave recovered");
  }
  function renderProjects() {
    const list = projects();
    const active = activeId();
    const sel = $("projectList"); sel.innerHTML = "";
    list.forEach((p) => {
      const o = document.createElement("option");
      o.value = p.id; o.textContent = `${p.metadata ? p.metadata.name : "Untitled"} · ${new Date(p.savedAt).toLocaleString()}`;
      sel.appendChild(o);
    });
    if (active) sel.value = active;
    const recent = $("recentProjects"); recent.innerHTML = "";
    recents().map((rid) => list.find((p) => p.id === rid)).filter(Boolean).forEach((p) => {
      const o = document.createElement("option"); o.value = p.id; o.textContent = p.metadata ? p.metadata.name : "Untitled"; recent.appendChild(o);
    });
  }
  function renderSnapshots(snaps) {
    const el = $("snapshotList"); el.innerHTML = "";
    (snaps || currentProjectSnapshots()).forEach((s) => {
      const b = document.createElement("button");
      b.type = "button"; b.textContent = `${s.name} · ${new Date(s.savedAt).toLocaleTimeString()}`;
      b.addEventListener("click", () => applyProject(s.state));
      el.appendChild(b);
    });
    if (!el.children.length) el.textContent = "No snapshots yet.";
  }
  function renderSamples() {
    const el = $("sampleList");
    const list = sampleManifest();
    if (!list.length) { el.textContent = "No samples loaded."; return; }
    el.innerHTML = list.map((s) => `<div><b>${s.role}</b> ${s.name || "unnamed"} <span>${s.duration ? s.duration.toFixed(1) + "s" : "ref only"}</span></div>`).join("");
  }
  function renderDockList() {
    const el = $("dockList"); if (!el) return;
    el.innerHTML = "";
    PANELS.forEach(([key, label]) => {
      const panel = panelElement(key);
      if (!panel) return;
      const row = document.createElement("label");
      row.innerHTML = `<input type="checkbox" ${panel.classList.contains("dock-hidden") ? "" : "checked"}> ${label}`;
      row.querySelector("input").addEventListener("change", (e) => {
        panel.classList.toggle("dock-hidden", !e.target.checked);
        scheduleHistory("dock"); scheduleAutosave();
      });
      el.appendChild(row);
    });
  }
  function workspaces() { const w = read(LS_WORKSPACES, []); return Array.isArray(w) ? w : []; }
  function renderWorkspaces() {
    const sel = $("workspacePreset"); sel.innerHTML = "";
    workspaces().forEach((w) => { const o = document.createElement("option"); o.value = w.id; o.textContent = w.name; sel.appendChild(o); });
    if (!sel.children.length) { const o = document.createElement("option"); o.value = ""; o.textContent = "No saved workspaces"; sel.appendChild(o); }
  }
  function saveWorkspace() {
    const name = prompt("Workspace name?", $("layoutSelect").value + " Workspace");
    if (!name) return;
    const list = workspaces();
    list.unshift({ id: id("workspace"), name, savedAt: nowIso(), layout: captureLayout() });
    write(LS_WORKSPACES, list.slice(0, 20)); renderWorkspaces(); status("workspace saved");
  }
  function loadWorkspace() {
    const w = workspaces().find((x) => x.id === $("workspacePreset").value);
    if (!w) return status("no workspace selected");
    applyLayout(w.layout); scheduleHistory("workspace"); status("workspace loaded");
  }
  function applyNamedLayout(name) {
    document.body.dataset.layout = name;
    const hidden = {};
    if (name === "Browser") { hidden.playerBoard = true; hidden.quickSplitBoard = true; hidden.lanesBoard = true; hidden.seqBoard = true; hidden.fuzzerBoard = false; }
    if (name === "Performance") { hidden.projectBoard = true; hidden.analyzeBoard = true; hidden.quickSplitBoard = true; hidden.fuzzerBoard = true; hidden.lanesBoard = true; hidden.presets = true; }
    applyLayout({ layout: name, hidden });
    scheduleHistory("layout"); scheduleAutosave();
  }
  function renderAll() {
    renderProjects(); renderSnapshots(); renderSamples(); renderDockList(); renderWorkspaces(); updateUndoButtons();
    $("projectRecover").classList.toggle("on", !!read(LS_AUTOSAVE, null));
  }
  function bind() {
    $("projectNew").addEventListener("click", newProject);
    $("projectSave").addEventListener("click", () => { saveProject(); pushHistory("save"); });
    $("projectLoad").addEventListener("click", () => applyProject(projects().find((p) => p.id === $("projectList").value)));
    $("recentProjects").addEventListener("change", () => applyProject(projects().find((p) => p.id === $("recentProjects").value)));
    $("projectSnapshot").addEventListener("click", saveSnapshot);
    $("projectUndo").addEventListener("click", undo);
    $("projectRedo").addEventListener("click", redo);
    $("projectRecover").addEventListener("click", recoverAutosave);
    $("workspaceSave").addEventListener("click", saveWorkspace);
    $("workspaceLoad").addEventListener("click", loadWorkspace);
    $("layoutSelect").addEventListener("change", (e) => applyNamedLayout(e.target.value));
    ["projectName","projectAuthor","projectGenre","projectKey","projectBpm","projectNotes"].forEach((id) => $(id).addEventListener("input", () => scheduleHistory("metadata")));
    document.addEventListener("input", (e) => { if (!e.target.closest("#projectBoard")) scheduleHistory("edit"); }, true);
    document.addEventListener("change", (e) => { if (!e.target.closest("#projectBoard")) scheduleHistory("change"); }, true);
    // knobs, toggles, wave selectors, octave buttons, and sequencer grid cells emit
    // no native input/change; they announce edits via this custom event (fix-s1)
    window.addEventListener("wf:edit", () => scheduleHistory("edit"));
    window.addEventListener("beforeunload", () => write(LS_AUTOSAVE, Object.assign(captureProject(), { autosavedAt: nowIso() })));
    if (WF.Player && WF.Player.onLoaded) WF.Player.onLoaded.push(() => { renderSamples(); scheduleHistory("sample"); scheduleAutosave(); });
  }
  function init() {
    if (!$("projectBoard")) return;
    bind(); applyMetadata({ name: "Untitled Project", author: "User", genre: "Dubstep", key: "—", bpm: WF.state ? WF.state.bpm : 140, notes: "" });
    document.body.dataset.layout = document.body.dataset.layout || "Studio";
    renderAll(); pushHistory("init");
    if (read(LS_AUTOSAVE, null)) status("autosave available");
  }

  WF.Project = { captureProject, applyProject, saveProject, undo, redo, recoverAutosave, sampleManifest, captureLayout, applyLayout };
  init();
})();
