/* wubflipz — IndexedDB key/value + project/snapshot store
 * Replaces localStorage for project/session persistence (Phase 1 item #1):
 * localStorage caps out around 5MB and blocks the main thread on every
 * JSON.stringify/parse; snapshots embed full project state so that ceiling
 * was reachable. IndexedDB has a much higher quota and its writes are async.
 *
 * Schema v2: three stores instead of one shared blob —
 *   "kv"        generic singleton values (active project id, autosave, workspaces, recents)
 *   "projects"  one record per project, keyPath "id", WITHOUT its snapshots
 *   "snapshots" one record per snapshot, keyPath "id", indexed by "projectId" —
 *               versioned restore points as independent records instead of a
 *               single array embedded in the project blob, so saving one project
 *               never rewrites every other project's snapshot history too.
 */
(function () {
  "use strict";
  const WF = (window.WF = window.WF || {});
  const DB_NAME = "wubflipz";
  const DB_VERSION = 2;
  const STORE_KV = "kv";
  const STORE_PROJECTS = "projects";
  const STORE_SNAPSHOTS = "snapshots";
  const SNAPSHOT_CAP = 20;
  let dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error("IndexedDB unavailable")); return; }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_KV)) db.createObjectStore(STORE_KV);
        if (!db.objectStoreNames.contains(STORE_PROJECTS)) db.createObjectStore(STORE_PROJECTS, { keyPath: "id" });
        if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
          const s = db.createObjectStore(STORE_SNAPSHOTS, { keyPath: "id" });
          s.createIndex("projectId", "projectId", { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function reqPromise(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // ---- generic kv ----
  async function get(key) {
    const db = await openDb();
    return reqPromise(db.transaction(STORE_KV, "readonly").objectStore(STORE_KV).get(key));
  }
  async function set(key, value) {
    const db = await openDb();
    const tx = db.transaction(STORE_KV, "readwrite");
    tx.objectStore(STORE_KV).put(value, key);
    return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(true); tx.onerror = () => reject(tx.error); });
  }
  async function del(key) {
    const db = await openDb();
    const tx = db.transaction(STORE_KV, "readwrite");
    tx.objectStore(STORE_KV).delete(key);
    return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(true); tx.onerror = () => reject(tx.error); });
  }

  // ---- projects (one record per project, no embedded snapshots) ----
  async function getAllProjects() {
    const db = await openDb();
    return reqPromise(db.transaction(STORE_PROJECTS, "readonly").objectStore(STORE_PROJECTS).getAll());
  }
  async function putProject(project) {
    const db = await openDb();
    const tx = db.transaction(STORE_PROJECTS, "readwrite");
    tx.objectStore(STORE_PROJECTS).put(project);
    return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(true); tx.onerror = () => reject(tx.error); });
  }
  async function deleteProject(projectId) {
    const db = await openDb();
    const tx = db.transaction([STORE_PROJECTS, STORE_SNAPSHOTS], "readwrite");
    tx.objectStore(STORE_PROJECTS).delete(projectId);
    const idx = tx.objectStore(STORE_SNAPSHOTS).index("projectId");
    idx.openCursor(IDBKeyRange.only(projectId)).onsuccess = (e) => { const c = e.target.result; if (c) { c.delete(); c.continue(); } };
    return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(true); tx.onerror = () => reject(tx.error); });
  }

  // ---- snapshots (one record per snapshot, capped per project) ----
  async function getSnapshotsForProject(projectId) {
    const db = await openDb();
    const list = await reqPromise(
      db.transaction(STORE_SNAPSHOTS, "readonly").objectStore(STORE_SNAPSHOTS).index("projectId").getAll(IDBKeyRange.only(projectId))
    );
    return list.sort((a, b) => (b.savedAt || "").localeCompare(a.savedAt || ""));
  }
  async function addSnapshot(projectId, snap) {
    const db = await openDb();
    const record = Object.assign({}, snap, { projectId });
    // Put + read-back + evict-over-cap all inside ONE readwrite transaction: IndexedDB
    // serializes readwrite transactions against the same store, but only a single
    // transaction is atomic against interleaving from another call. Splitting this
    // across multiple transactions (as an earlier version did) let concurrent calls
    // (e.g. rapid repeated clicks) each read a stale count and under-evict.
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SNAPSHOTS, "readwrite");
      const store = tx.objectStore(STORE_SNAPSHOTS);
      store.put(record);
      const idx = store.index("projectId");
      const getAllReq = idx.getAll(IDBKeyRange.only(projectId));
      getAllReq.onsuccess = () => {
        const all = getAllReq.result.sort((a, b) => (b.savedAt || "").localeCompare(a.savedAt || ""));
        if (all.length > SNAPSHOT_CAP) all.slice(SNAPSHOT_CAP).forEach((s) => store.delete(s.id));
      };
      tx.oncomplete = () => resolve(record);
      tx.onerror = () => reject(tx.error);
    });
  }

  // ---- one-time schema migration: v1 single "kv" blob -> v2 per-record stores ----
  // Runs after the localStorage->IndexedDB migration (js/projects.js) has already
  // landed everything under the old LS_PROJECTS kv key. Splits each project's
  // embedded `snapshots` array into independent snapshot records and stores the
  // lean project (without that array) in its own record. The old blob key is only
  // removed after every project and every snapshot has been confirmed written.
  async function migrateBlobToRecords(oldProjectsKey) {
    if (await get("migrated.v2")) return;
    const blob = await get(oldProjectsKey);
    if (Array.isArray(blob) && blob.length) {
      for (const p of blob) {
        const snaps = Array.isArray(p.snapshots) ? p.snapshots : [];
        const lean = Object.assign({}, p);
        delete lean.snapshots;
        await putProject(lean);
        for (const s of snaps) await addSnapshot(p.id, s);
      }
    }
    await set("migrated.v2", true);
    await del(oldProjectsKey);
  }

  WF.DB = {
    get, set, del,
    getAllProjects, putProject, deleteProject,
    getSnapshotsForProject, addSnapshot,
    migrateBlobToRecords,
    get available() { return !!window.indexedDB; },
  };
})();
