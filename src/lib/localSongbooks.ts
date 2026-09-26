/**
 * .sbk files the user opened from disk, kept in IndexedDB so they can be
 * reopened later. Each one is addressed by a `local:<id>` book URL, which
 * works like any other book URL in this browser but means nothing elsewhere.
 */

import { SONGBOOK_STORE, withStore } from '@/lib/db'

export const LOCAL_BOOK_PREFIX = 'local:'

interface LocalSongbookRecord {
  id: string
  fileName: string
  addedAt: number
  bytes: ArrayBuffer
}

export function isLocalBook(url: string): boolean {
  return url.startsWith(LOCAL_BOOK_PREFIX)
}

function idOf(url: string): string {
  return url.slice(LOCAL_BOOK_PREFIX.length)
}

/** Stores the file and resolves to the book URL that opens it. */
export async function storeLocalSongbook(file: File): Promise<string> {
  const id = crypto.randomUUID()
  const record: LocalSongbookRecord = {
    id,
    fileName: file.name,
    addedAt: Date.now(),
    bytes: await file.arrayBuffer(),
  }
  await withStore(SONGBOOK_STORE, 'readwrite', (s) => s.put(record))
  return `${LOCAL_BOOK_PREFIX}${id}`
}

export async function readLocalSongbook(url: string): Promise<ArrayBuffer> {
  const record = await withStore(
    SONGBOOK_STORE,
    'readonly',
    (s) => s.get(idOf(url)) as IDBRequest<LocalSongbookRecord | undefined>,
  )
  if (!record) throw new Error('this songbook is no longer stored in this browser')
  return record.bytes
}

export function deleteLocalSongbook(url: string): Promise<undefined> {
  return withStore(SONGBOOK_STORE, 'readwrite', (s) => s.delete(idOf(url)))
}
