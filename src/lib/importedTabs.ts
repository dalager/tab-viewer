/** IndexedDB store for Guitar Pro files the user imported themselves. */

import { IMPORTED_STORE, withStore } from '@/lib/db'

/** Every imported piece's id starts with this, so stored ids can be told apart. */
export const IMPORTED_ID_PREFIX = 'imported-'

export interface ImportedRecord {
  id: string
  title: string
  artist: string
  ext: string
  addedAt: number
  bytes: ArrayBuffer
}

export function listImported(): Promise<ImportedRecord[]> {
  return withStore(IMPORTED_STORE, 'readonly', (s) => s.getAll() as IDBRequest<ImportedRecord[]>)
}

export function putImported(record: ImportedRecord): Promise<IDBValidKey> {
  return withStore(IMPORTED_STORE, 'readwrite', (s) => s.put(record))
}

export function deleteImported(id: string): Promise<undefined> {
  return withStore(IMPORTED_STORE, 'readwrite', (s) => s.delete(id))
}
