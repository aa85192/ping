/** Tiny IndexedDB key-value store for offline copies of 票券夾 files (per device). */
const DB = 'ping-files';
const STORE = 'blobs';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const r = fn(db.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export const idbGet = (key: string) => tx<Blob | undefined>('readonly', (s) => s.get(key) as IDBRequest<Blob | undefined>).catch(() => undefined);
export const idbPut = (key: string, blob: Blob) => tx('readwrite', (s) => s.put(blob, key)).catch(() => undefined);
export const idbDel = (key: string) => tx('readwrite', (s) => s.delete(key)).catch(() => undefined);
export const idbKeys = () => tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys()).catch(() => [] as IDBValidKey[]);
