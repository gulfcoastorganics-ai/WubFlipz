/* wubflipz — IndexedDB key/value store
 * Replaces localStorage for project/session persistence (Phase 1 item #1):
 * localStorage caps out around 5MB and blocks the main thread on every
 * JSON.stringify/parse; snapshots embed full project state so that ceiling
 * was reachable. IndexedDB has a much higher quota and its writes are async.
 * Single object store, one record per logical key (projects list, active id,
 * autosave, workspaces, recents) — callers keep the same key names that used
 * to be localStorage keys.
 */
(function () {
  "use strict";
  const WF = (window.WF = window.WF || {});
  const DB_NAME = "wubflipz";
  const DB_VERSION = 1;
  const STORE = "kv";
  let dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error("IndexedDB unavailable")); return; }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function get(key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function set(key, value) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }
  async function del(key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  WF.DB = { get, set, del, get available() { return !!window.indexedDB; } };
})();
