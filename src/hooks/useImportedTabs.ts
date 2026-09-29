import { useCallback, useEffect, useState } from 'react'
import {
  deleteImported,
  type ImportedRecord,
  listImported,
  putImported,
  IMPORTED_ID_PREFIX,
} from '@/lib/importedTabs'
import { IMPORTED_BOOK } from '@/lib/pieces'
import { errorMessage } from '@/lib/utils'
import { readScoreMetadata } from '@/score/metadata'
import type { TabEntry } from '@/types'

/** Formats alphaTab can open. gp3-5 are binary, gpx/gp are zipped XML. */
export const IMPORT_EXTENSIONS = ['gp3', 'gp4', 'gp5', 'gpx', 'gp']
export const IMPORT_ACCEPT = IMPORT_EXTENSIONS.map((e) => `.${e}`).join(',')


export interface UseImportedTabs {
  /** Imported pieces, oldest first. Empty until `ready`. */
  imported: TabEntry[]
  /** True once IndexedDB has been read, so a stored selection can be resolved. */
  ready: boolean
  /** Last failure message, cleared by the next successful import. */
  error: string | null
  /** Parses, stores and lists each file. Resolves to the ids that were added. */
  importFiles: (files: Iterable<File>) => Promise<string[]>
  removeImported: (id: string) => Promise<void>
}

function toEntry(record: ImportedRecord): TabEntry {
  return {
    book: IMPORTED_BOOK,
    id: record.id,
    title: record.title,
    artist: record.artist,
    ext: record.ext,
    // A blob URL, like a .sbk piece's, so every piece is loaded by fetching `file`.
    file: URL.createObjectURL(new Blob([record.bytes])),
  }
}

function newId(): string {
  const uuid =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return `${IMPORTED_ID_PREFIX}${uuid}`
}

function stem(name: string): string {
  return name.replace(/\.[^.]+$/, '')
}

async function toRecord(file: File): Promise<ImportedRecord> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!IMPORT_EXTENSIONS.includes(ext)) {
    throw new Error(`${file.name}: not a Guitar Pro file (${IMPORT_ACCEPT})`)
  }
  const bytes = await file.arrayBuffer()
  let meta: { title: string; artist: string }
  try {
    meta = readScoreMetadata(bytes)
  } catch (e) {
    const reason = errorMessage(e)
    throw new Error(`${file.name}: could not be read (${reason})`)
  }
  return {
    id: newId(),
    title: meta.title || stem(file.name),
    artist: meta.artist || 'Imported',
    ext,
    addedAt: Date.now(),
    bytes,
  }
}

/** Stores each file, collecting the entries added and a message per failure. */
async function storeAll(files: Iterable<File>): Promise<{ added: TabEntry[]; failures: string[] }> {
  const added: TabEntry[] = []
  const failures: string[] = []
  for (const file of files) {
    try {
      const record = await toRecord(file)
      await putImported(record)
      added.push(toEntry(record))
    } catch (e) {
      failures.push(errorMessage(e))
    }
  }
  return { added, failures }
}

/** The list without that piece, freeing its blob URL. */
function withoutImport(tabs: TabEntry[], id: string): TabEntry[] {
  const gone = tabs.find((t) => t.id === id)
  if (gone) URL.revokeObjectURL(gone.file)
  return tabs.filter((t) => t.id !== id)
}

/**
 * User-imported pieces, persisted in IndexedDB so they survive a reload.
 *
 * Each file is held in memory as a blob URL: they are small (a few hundred KB
 * at most), and it lets imports load exactly like songbook pieces.
 */
export function useImportedTabs(): UseImportedTabs {
  const [imported, setImported] = useState<TabEntry[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listImported()
      .then((records) => {
        if (cancelled) return
        records.sort((a, b) => a.addedAt - b.addedAt)
        setImported(records.map(toEntry))
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(errorMessage(e))
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const importFiles = useCallback(async (files: Iterable<File>) => {
    const { added, failures } = await storeAll(files)
    if (added.length > 0) setImported((prev) => [...prev, ...added])
    setError(failures.length > 0 ? failures.join('\n') : null)
    return added.map((t) => t.id)
  }, [])

  const removeImported = useCallback(async (id: string) => {
    try {
      await deleteImported(id)
    } catch (e) {
      setError(errorMessage(e))
      return
    }
    setImported((prev) => withoutImport(prev, id))
  }, [])

  return { imported, ready, error, importFiles, removeImported }
}
