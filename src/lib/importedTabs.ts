/** Guitar Pro files the user imported themselves: which files qualify, and their IndexedDB store. */

import { IMPORTED_STORE, withStore } from '@/lib/db'

/** Every imported piece's id starts with this, so stored ids can be told apart. */
export const IMPORTED_ID_PREFIX = 'imported-'

/** Formats alphaTab can open. gp3-5 are binary, gpx/gp are zipped XML. */
export const IMPORT_EXTENSIONS = ['gp3', 'gp4', 'gp5', 'gpx', 'gp']
export const IMPORT_ACCEPT = IMPORT_EXTENSIONS.map((e) => `.${e}`).join(',')

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

/** A fresh id for an imported piece; random, since titles repeat. */
export function newImportId(): string {
  const uuid =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return `${IMPORTED_ID_PREFIX}${uuid}`
}

/** The file's extension, lower case; throws unless alphaTab can open it. */
export function importExtension(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  if (!IMPORT_EXTENSIONS.includes(ext)) {
    throw new Error(`${fileName}: not a Guitar Pro file (${IMPORT_ACCEPT})`)
  }
  return ext
}

/** What an import stores. A file without a title is named after itself. */
export function importedRecord(
  file: { name: string; ext: string; bytes: ArrayBuffer },
  meta: { title: string; artist: string },
): ImportedRecord {
  return {
    id: newImportId(),
    title: meta.title || file.name.replace(/\.[^.]+$/, ''),
    artist: meta.artist || 'Imported',
    ext: file.ext,
    addedAt: Date.now(),
    bytes: file.bytes,
  }
}
