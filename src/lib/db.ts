/**
 * The app's IndexedDB database. Binary files live here rather than in
 * localStorage: a handful of them would blow through its ~5 MB string budget.
 */

const DB_NAME = 'tab-viewer'
const DB_VERSION = 2

/** Guitar Pro files the user imported, keyed by id. */
export const IMPORTED_STORE = 'imported'
/** .sbk songbooks the user opened from disk, keyed by id. */
export const SONGBOOK_STORE = 'songbooks'

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'))
  })
}

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available in this browser'))
  }
  const req = indexedDB.open(DB_NAME, DB_VERSION)
  req.onupgradeneeded = () => {
    for (const name of [IMPORTED_STORE, SONGBOOK_STORE]) {
      if (!req.result.objectStoreNames.contains(name)) {
        req.result.createObjectStore(name, { keyPath: 'id' })
      }
    }
  }
  return request(req)
}

export async function withStore<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb()
  try {
    return await request(run(db.transaction(store, mode).objectStore(store)))
  } finally {
    db.close()
  }
}
