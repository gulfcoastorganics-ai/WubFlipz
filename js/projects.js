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
  const FIELD_LABELS = {
    bpm: "Wobble BPM",
    wobbleDiv: "Wobble Division",
    presetName: "Preset Name",
    presetSearch: "Preset Search",
    detBpm: "Detected BPM",
    detKey: "Detected Key",
    seqBpm: "Sequencer BPM",
  };
  let undoStack = [], redoStack = [], applying = false, saveTimer = 0, historyTimer = 0;

  // In-memory mirror of the IndexedDB-backed store: reads stay synchronous
  // (nearly every call site below predates async storage), writes go through
  // WF.DB and update the mirror immediately so a slow/failed persist never
  // desyncs what the UI sees this session. `snapshots` mirrors only the active
  // project's restore points (each one is its own IndexedDB record, not an
  // array embedded in the project — see js/db.js).
  const cache = { projects: [], active: "", autosave: null, workspaces: [], recents: [], snapshots: [] };

  async function persist(key, value) {
    try { await WF.DB.set(key, value); return true; }
    catch (e) {
      // storage failures must never be silent (fix-s1): callers also surface via status()
      console.error("wubflipz: storage write failed for", key, "—", e && e.name ? e.name : e);
      return false;
    }
  }
  function activeId() { return cache.active; }
  async function setActiveId(id) { cache.active = id; return persist(LS_ACTIVE, id); }
  function nowIso() { return new Date().toISOString(); }
  function id(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`; }
  function status(msg) {
    const el = $("projectStatus");
    if (el) el.textContent = msg;
    window.dispatchEvent(new CustomEvent("wf:workflow-update"));
  }
  function toast(msg, detail, tone) {
    window.dispatchEvent(new CustomEvent("wf:toast", { detail: { message: msg, detail, tone } }));
  }
  function workflowStatus(title, detail, tone) {
    window.dispatchEvent(new CustomEvent("wf:status", { detail: { title, detail, tone } }));
  }
  function autosaveState(label, detail, tone) {
    const el = $("autosaveStatus");
    if (!el) return;
    el.classList.remove("ok", "saving", "warn", "fail", "saved-pulse");
    el.classList.add(tone || "ok");
    const b = el.querySelector("b"), small = $("autosaveTime");
    if (b) b.textContent = label;
    if (small) small.textContent = detail || "";
    if ((tone || "ok") === "ok") {
      void el.offsetWidth;
      el.classList.add("saved-pulse");
    }
  }
  function timeLabel(d) { return d ? new Date(d).toLocaleTimeString() : new Date().toLocaleTimeString(); }
  function projects() { return cache.projects; }
  async function saveProjectRecord(p) {
    try { await WF.DB.putProject(p); }
    catch (e) { console.error("wubflipz: project save failed —", e && e.name ? e.name : e); return false; }
    const i = cache.projects.findIndex((x) => x.id === p.id);
    if (i >= 0) cache.projects[i] = p; else cache.projects.unshift(p);
    return true;
  }
  function recents() { return cache.recents; }
  async function markRecent(projectId) {
    cache.recents = [projectId].concat(recents().filter((x) => x !== projectId)).slice(0, 10);
    return persist(LS_RECENTS, cache.recents);
  }
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
  function currentProjectSnapshots() { return cache.snapshots; }
  async function loadSnapshotsForActive() {
    const active = activeId();
    cache.snapshots = active ? await WF.DB.getSnapshotsForProject(active) : [];
  }
  async function applyProject(project, opts) {
    if (!project) return false;
    applying = true;
    try {
      await setActiveId(project.id);
      applyMetadata(project.metadata);
      if (project.preset && WF.Presets && WF.Presets.apply) WF.Presets.apply(project.preset);
      applyLayout(project.layout);
      await markRecent(project.id);
      await loadSnapshotsForActive();
      renderAll();
      if (!opts || !opts.noHistory) pushHistory("load");
      status(`loaded ${project.metadata && project.metadata.name ? project.metadata.name : "project"}`);
      window.dispatchEvent(new CustomEvent("wf:dirty-clear", { detail: { scope: "all" } }));
      toast(`Session Loaded`, `${project.metadata && project.metadata.name ? project.metadata.name : "Project"} restored.`);
      return true;
    } finally { applying = false; }
  }
  async function saveProject() {
    const p = captureProject();
    // snapshots are independent IndexedDB records now — saving a project never
    // rewrites another project's history, or even its own snapshot list.
    if (!(await saveProjectRecord(p))) {
      status("project save FAILED — storage full?"); autosaveState("Storage Full", "Project save failed", "fail");
      toast("Session Save Failed", "Project saves this session. Storage may be full.", "fail");
      return p;
    }
    await setActiveId(p.id); await markRecent(p.id); await loadSnapshotsForActive();
    renderAll(); status("project saved"); autosaveState("Saved", timeLabel(), "ok");
    window.dispatchEvent(new CustomEvent("wf:dirty-clear", { detail: { scope: "session" } }));
    toast("Session Saved", `Project saved this session at ${timeLabel()}.`);
    return p;
  }
  async function newProject() {
    await setActiveId(id("project"));
    applyMetadata({ name: "Untitled Project", author: "User", genre: "Dubstep", key: "—", bpm: WF.state ? WF.state.bpm : 140, notes: "" });
    pushHistory("new"); scheduleAutosave(); renderAll(); status("new project"); toast("New Session", "Started a clean project.");
  }
  async function saveSnapshot() {
    const p = await saveProject();
    const snap = { id: id("snapshot"), name: `${p.metadata.name} ${new Date().toLocaleTimeString()}`, savedAt: nowIso(), state: captureProject(p.metadata.name) };
    try {
      // versioned, independent record — capped per-project at 20, oldest evicted (fix-s1)
      await WF.DB.addSnapshot(p.id, snap);
    } catch (e) {
      status("snapshot save FAILED — storage full?"); autosaveState("Storage Full", "Snapshot failed", "fail");
      toast("Snapshot Failed", "Could not create restore point.", "fail"); return;
    }
    await loadSnapshotsForActive();
    renderSnapshots(cache.snapshots); status("snapshot saved"); toast("Restore Point Created", `Snapshot saved at ${timeLabel()}.`);
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
  async function undo() {
    if (undoStack.length < 2) return;
    const cur = undoStack.pop();
    redoStack.push(cur);
    await applyProject(undoStack[undoStack.length - 1], { noHistory: true });
    updateUndoButtons(); status("undo"); toast(`Undo: ${cur.reason || "Edit"}`);
  }
  async function redo() {
    const next = redoStack.pop();
    if (!next) return;
    undoStack.push(next);
    await applyProject(next, { noHistory: true });
    updateUndoButtons(); status("redo"); toast(`Redo: ${next.reason || "Edit"}`);
  }
  function updateUndoButtons() {
    const canUndo = undoStack.length > 1, canRedo = redoStack.length > 0;
    ["projectUndo", "globalUndo"].forEach((id) => {
      const b = $(id); if (!b) return;
      b.classList.toggle("on", canUndo); b.disabled = !canUndo; b.setAttribute("aria-disabled", canUndo ? "false" : "true");
    });
    ["projectRedo", "globalRedo"].forEach((id) => {
      const b = $(id); if (!b) return;
      b.classList.toggle("on", canRedo); b.disabled = !canRedo; b.setAttribute("aria-disabled", canRedo ? "false" : "true");
    });
  }
  function scheduleAutosave() {
    if (applying) return;
    clearTimeout(saveTimer);
    autosaveState("Saving...", "", "saving");
    saveTimer = setTimeout(async () => {
      const p = captureProject();
      p.autosavedAt = nowIso();
      cache.autosave = p;
      if (await persist(LS_AUTOSAVE, p)) {
        status(`autosaved ${new Date().toLocaleTimeString()}`); autosaveState("Autosaved", timeLabel(p.autosavedAt), "ok");
        workflowStatus("Autosaved", `Session recovery saved at ${timeLabel(p.autosavedAt)}.`);
      }
      else { status("autosave FAILED — storage full?"); autosaveState("Storage Full", "Autosave failed", "fail"); toast("Autosave Failed", "Storage may be full.", "fail"); }
    }, 1200);
  }
  function scheduleHistory(reason) {
    if (applying) return;
    clearTimeout(historyTimer);
    historyTimer = setTimeout(() => { pushHistory(reason); scheduleAutosave(); }, 300);
  }
  async function recoverAutosave() {
    const p = cache.autosave;
    if (!p) return status("no autosave found");
    await applyProject(p); status("autosave recovered"); autosaveState("Recovered", "just now", "warn"); toast("Recovery Loaded", "Autosaved session restored.", "warn");
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
    el.textContent = "";
    if (!list.length) { el.textContent = "No samples loaded. Samples, split stems, and pad references appear here."; return; }
    list.forEach((s) => {
      const row = document.createElement("div");
      const left = document.createElement("span");
      const role = document.createElement("b");
      const meta = document.createElement("span");
      role.textContent = s.role;
      left.append(role, document.createTextNode(` ${s.name || "unnamed"}`));
      meta.textContent = s.duration ? `${s.duration.toFixed(1)}s` : "ref only";
      row.append(left, meta);
      el.appendChild(row);
    });
  }
  function renderDockList() {
    const el = $("dockList"); if (!el) return;
    el.innerHTML = "";
    PANELS.forEach(([key, label]) => {
      const panel = panelElement(key);
      if (!panel) return;
      const row = document.createElement("label");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = !panel.classList.contains("dock-hidden");
      row.append(input, document.createTextNode(` ${label}`));
      input.addEventListener("change", (e) => {
        panel.classList.toggle("dock-hidden", !e.target.checked);
        scheduleHistory("dock"); scheduleAutosave();
      });
      el.appendChild(row);
    });
  }
  function workspaces() { return cache.workspaces; }
  function renderWorkspaces() {
    const sel = $("workspacePreset"); sel.innerHTML = "";
    workspaces().forEach((w) => { const o = document.createElement("option"); o.value = w.id; o.textContent = w.name; sel.appendChild(o); });
    if (!sel.children.length) { const o = document.createElement("option"); o.value = ""; o.textContent = "No saved workspaces"; sel.appendChild(o); }
  }
  async function saveWorkspace() {
    const name = prompt("Workspace name?", $("layoutSelect").value + " Workspace");
    if (!name) return;
    const list = workspaces().slice(0, 20);
    list.unshift({ id: id("workspace"), name, savedAt: nowIso(), layout: captureLayout() });
    cache.workspaces = list.slice(0, 20);
    if (await persist(LS_WORKSPACES, cache.workspaces)) { renderWorkspaces(); status("layout saved"); toast("Layout Saved", `Workspace layout saved at ${timeLabel()}.`); }
    else { status("layout save failed"); toast("Layout Save Failed", "Workspace saves layout only. Storage may be full.", "fail"); }
  }
  function loadWorkspace() {
    const w = workspaces().find((x) => x.id === $("workspacePreset").value);
    if (!w) return status("no workspace selected");
    applyLayout(w.layout); scheduleHistory("workspace"); status("layout loaded"); toast("Layout Loaded", "Workspace layout restored.");
  }
  function applyNamedLayout(name) {
    document.body.dataset.layout = name;
    const hidden = {};
    if (name === "Browser") { hidden.playerBoard = true; hidden.quickSplitBoard = true; hidden.lanesBoard = true; hidden.seqBoard = true; hidden.fuzzerBoard = false; }
    if (name === "Performance") { hidden.analyzeBoard = true; hidden.quickSplitBoard = true; hidden.fuzzerBoard = true; hidden.lanesBoard = true; hidden.presets = true; }
    applyLayout({ layout: name, hidden });
    scheduleHistory("layout"); scheduleAutosave();
  }
  function renderAll() {
    renderProjects(); renderSnapshots(); renderSamples(); renderDockList(); renderWorkspaces(); updateUndoButtons();
    $("projectRecover").classList.toggle("on", !!cache.autosave);
  }
  function bind() {
    $("projectNew").addEventListener("click", newProject);
    $("projectSave").addEventListener("click", () => { saveProject(); pushHistory("save"); });
    $("projectLoad").addEventListener("click", () => applyProject(projects().find((p) => p.id === $("projectList").value)));
    $("recentProjects").addEventListener("change", () => applyProject(projects().find((p) => p.id === $("recentProjects").value)));
    $("projectSnapshot").addEventListener("click", saveSnapshot);
    $("projectUndo").addEventListener("click", undo);
    $("projectRedo").addEventListener("click", redo);
    if ($("globalUndo")) $("globalUndo").addEventListener("click", undo);
    if ($("globalRedo")) $("globalRedo").addEventListener("click", redo);
    if ($("projectExpand")) $("projectExpand").addEventListener("click", () => {
      const board = $("projectBoard");
      const panel = $("projectExpanded");
      const expanded = !board.classList.contains("expanded");
      board.classList.toggle("expanded", expanded);
      $("projectExpand").setAttribute("aria-expanded", expanded ? "true" : "false");
      $("projectExpand").textContent = expanded ? "Collapse" : "Expand";
      if (panel) {
        panel.toggleAttribute("inert", !expanded);
        panel.setAttribute("aria-hidden", expanded ? "false" : "true");
      }
    });
    $("projectRecover").addEventListener("click", recoverAutosave);
    $("workspaceSave").addEventListener("click", saveWorkspace);
    $("workspaceLoad").addEventListener("click", loadWorkspace);
    $("layoutSelect").addEventListener("change", (e) => applyNamedLayout(e.target.value));
    ["projectName","projectAuthor","projectGenre","projectKey","projectBpm","projectNotes"].forEach((id) => $(id).addEventListener("input", () => scheduleHistory("metadata")));
    document.addEventListener("input", (e) => { if (!e.target.closest("#projectBoard")) scheduleHistory(FIELD_LABELS[e.target.id] || "Edit"); }, true);
    document.addEventListener("change", (e) => { if (!e.target.closest("#projectBoard")) scheduleHistory(FIELD_LABELS[e.target.id] || "Change"); }, true);
    // knobs, toggles, wave selectors, octave buttons, and sequencer grid cells emit
    // no native input/change; they announce edits via this custom event (fix-s1)
    window.addEventListener("wf:edit", (e) => scheduleHistory((e.detail && e.detail.label) || "Edit"));
    window.addEventListener("keydown", (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "z" && e.shiftKey) { redo(); e.preventDefault(); }
      else if (key === "z") { undo(); e.preventDefault(); }
      else if (key === "y") { redo(); e.preventDefault(); }
    });
    // best-effort only: IndexedDB writes are async and may not finish before the
    // page unloads. visibilitychange (below) is the reliable persistence point;
    // this just improves the odds on a hard close.
    window.addEventListener("beforeunload", () => {
      const p = Object.assign(captureProject(), { autosavedAt: nowIso() });
      cache.autosave = p;
      persist(LS_AUTOSAVE, p);
    });
    document.addEventListener("visibilitychange", () => { if (document.hidden) scheduleAutosave(); });
    if (WF.Player && WF.Player.onLoaded) WF.Player.onLoaded.push(() => { renderSamples(); scheduleHistory("sample"); scheduleAutosave(); });
  }

  // ---- one-time migration from the old localStorage keys into IndexedDB ----
  // Runs before the cache loads. Old keys are only removed after every value
  // has been confirmed written to IndexedDB, so a failed migration leaves the
  // localStorage copy intact to retry next load.
  async function migrateFromLocalStorage() {
    if (await WF.DB.get("migrated.v1")) return;
    const readLS = (key, fallback) => {
      try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
      catch (e) { return fallback; }
    };
    let legacyActive = "";
    try { legacyActive = localStorage.getItem(LS_ACTIVE) || ""; } catch (e) {}
    const values = {
      [LS_PROJECTS]: readLS(LS_PROJECTS, []),
      [LS_AUTOSAVE]: readLS(LS_AUTOSAVE, null),
      [LS_WORKSPACES]: readLS(LS_WORKSPACES, []),
      [LS_RECENTS]: readLS(LS_RECENTS, []),
      [LS_ACTIVE]: legacyActive,
    };
    for (const [key, value] of Object.entries(values)) await WF.DB.set(key, value);
    await WF.DB.set("migrated.v1", true);
    try {
      localStorage.removeItem(LS_PROJECTS); localStorage.removeItem(LS_ACTIVE);
      localStorage.removeItem(LS_AUTOSAVE); localStorage.removeItem(LS_WORKSPACES);
      localStorage.removeItem(LS_RECENTS);
    } catch (e) {}
  }
  async function loadCache() {
    cache.projects = (await WF.DB.getAllProjects()).sort((a, b) => (b.savedAt || "").localeCompare(a.savedAt || ""));
    cache.active = (await WF.DB.get(LS_ACTIVE)) || "";
    cache.autosave = (await WF.DB.get(LS_AUTOSAVE)) || null;
    cache.workspaces = (await WF.DB.get(LS_WORKSPACES)) || [];
    cache.recents = (await WF.DB.get(LS_RECENTS)) || [];
    await loadSnapshotsForActive();
  }

  async function init() {
    if (!$("projectBoard")) return;
    try {
      await migrateFromLocalStorage();
      // one project blob (with embedded snapshot arrays) -> one record per
      // project + one record per snapshot (js/db.js schema v2)
      await WF.DB.migrateBlobToRecords(LS_PROJECTS);
      await loadCache();
    }
    catch (e) { console.error("wubflipz: IndexedDB unavailable, session persistence disabled —", e); }
    bind(); applyMetadata({ name: "Untitled Project", author: "User", genre: "Dubstep", key: "—", bpm: WF.state ? WF.state.bpm : 140, notes: "" });
    document.body.dataset.layout = document.body.dataset.layout || "Studio";
    renderAll(); pushHistory("init");
    if (cache.autosave) { status("autosave available"); autosaveState("Recovery Available", "Autosave found", "warn"); }
    else autosaveState("Autosave ready", "—", "ok");
    // fires once the IndexedDB-backed cache has loaded; ux.js's one-shot
    // showContinueSession() runs earlier (synchronously at script load) and
    // needs a nudge once real project data is available.
    window.dispatchEvent(new CustomEvent("wf:projects-ready"));
  }

  WF.Project = {
    captureProject, applyProject, saveProject, undo, redo, recoverAutosave, sampleManifest, captureLayout, applyLayout,
    hasActiveSession: () => !!activeId(),
    latestProjectMeta: () => { const list = projects(); return list.length ? list[0] : null; },
  };
  init();
})();
