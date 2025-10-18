// Lightweight form persistence helper
// - Uses localStorage for simple JSON-serializable fields
// - Uses IndexedDB (via idb library if available) for blob storage; falls back to storing blob metadata in localStorage

const DB_NAME = 'tahanap_form_persistence_v1';
const STORE_NAME = 'files';

// Minimal IndexedDB helper
function openDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) return resolve(null);
    const req = window.indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

export async function saveFormState(key, stateObj) {
  try {
    localStorage.setItem(`form:${key}`, JSON.stringify(stateObj));
  } catch (e) {
    console.error('saveFormState error', e);
  }
}

export function loadFormState(key) {
  try {
    const raw = localStorage.getItem(`form:${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Strip any file-related fields to avoid rehydrating images/video/panorama.
    // We intentionally do NOT restore files from storage to avoid large memory use and bugs.
    try {
      if (parsed && parsed.fields) {
        delete parsed.fields.images;
        delete parsed.fields.video;
        delete parsed.fields.panorama;
        // Also remove any fallback metadata that might exist
        try { localStorage.removeItem(`form:${key}:files:images`); } catch(e){}
        try { localStorage.removeItem(`form:${key}:files:video`); } catch(e){}
        try { localStorage.removeItem(`form:${key}:files:panorama`); } catch(e){}
        // Persist the sanitized copy back so future loads don't include those fields
        try { localStorage.setItem(`form:${key}`, JSON.stringify(parsed)); } catch(e){}
      }
    } catch (e) {
      // ignore
    }
    return parsed;
  } catch (e) {
    console.error('loadFormState error', e);
    return null;
  }
}

// Save File blobs to IndexedDB under a composite id (formKey + field + filename + timestamp)
export async function saveFiles(formKey, fieldName, files) {
  // Intentionally do NOT persist file blobs anymore. Clear any leftover fallback metadata.
  try { localStorage.removeItem(`form:${formKey}:files:${fieldName}`); } catch (e) {}
  return [];
}

export async function loadFiles(formKey, fieldName) {
  // Files are no longer persisted by design. Ensure any fallback metadata is removed and return empty.
  try { localStorage.removeItem(`form:${formKey}:files:${fieldName}`); } catch (e) {}
  return [];
}

export async function clearFormPersistence(formKey) {
  try {
    localStorage.removeItem(`form:${formKey}`);
    // clear file store entries
    const db = await openDB();
    if (!db) return;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const keysToDelete = [];
      store.openCursor().onsuccess = (evt) => {
        const cursor = evt.target.result;
        if (cursor) {
          try {
            const key = String(cursor.key);
            // Previously we only deleted keys that started with formKey: which missed
            // records when file ids embedded timestamps or other separators. Match any
            // id that contains the formKey segment to be more robust.
            if (key && key.indexOf(`${formKey}:`) !== -1) {
              store.delete(cursor.key);
            }
          } catch (e) {
            // ignore malformed keys
          }
          cursor.continue();
        } else resolve();
      };
    });
  } catch (e) { console.error('clearFormPersistence error', e); }
}

// Purge a full form draft: clear the stored fields plus any file blobs and fallback metadata.
export async function purgeFormDraft(formKey) {
  try {
    // Remove main form payload
    try { localStorage.removeItem(`form:${formKey}`); } catch (e) {}

    // Remove any file metadata fallbacks in localStorage that may be keyed by field
    try {
      const prefix = `form:${formKey}:files:`;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.indexOf(prefix) !== -1) {
          try { localStorage.removeItem(key); } catch (e) {}
        }
      }
    } catch (e) {
      // ignore localStorage iteration errors
    }

    // Remove IndexedDB blobs whose id contains the formKey segment anywhere
    const db = await openDB();
    if (!db) return;
    await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      // Use cursor to inspect keys and delete any that include the formKey pattern
      store.openCursor().onsuccess = (evt) => {
        const cursor = evt.target.result;
        if (cursor) {
          try {
            const key = String(cursor.key || '');
            if (key.indexOf(`${formKey}:`) !== -1) {
              store.delete(cursor.key);
            }
          } catch (e) {
            // ignore per-record errors
          }
          cursor.continue();
        } else resolve();
      };
      tx.onerror = () => resolve();
    });
  } catch (e) {
    console.error('purgeFormDraft error', e);
  }
}

export default { saveFormState, loadFormState, saveFiles, loadFiles, clearFormPersistence, purgeFormDraft };
