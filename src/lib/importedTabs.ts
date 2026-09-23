/**
 * IndexedDB store for Guitar Pro files the user imported themselves.
 *
 * The bytes live here rather than in localStorage: files are binary and a
 * handful of them would blow through the ~5 MB string budget.
 */

const DB_NAME = 'tab-viewer'
const DB_VERSION = 1
const STORE = 'imported'

export interface ImportedRecord {
  id: string
  title: string
  artist: string
  ext: string
  addedAt: number
  bytes: ArrayBuffer
}

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
    if (!req.result.objectStoreNames.contains(STORE)) {
      req.result.createObjectStore(STORE, { keyPath: 'id' })
    }
  }
  return request(req)
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb()
  try {
    return await request(run(db.transaction(STORE, mode).objectStore(STORE)))
  } finally {
    db.close()
  }
}

export function listImported(): Promise<ImportedRecord[]> {
  return withStore('readonly', (store) => store.getAll() as IDBRequest<ImportedRecord[]>)
}

export function putImported(record: ImportedRecord): Promise<IDBValidKey> {
  return withStore('readwrite', (store) => store.put(record))
}

export function deleteImported(id: string): Promise<undefined> {
  return withStore('readwrite', (store) => store.delete(id))
}
