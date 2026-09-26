import * as alphaTab from '@coderline/alphatab'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  deleteImported,
  type ImportedRecord,
  listImported,
  putImported,
} from '@/lib/importedTabs'
import { errorMessage } from '@/lib/utils'
import type { TabEntry } from '@/types'

/** Formats alphaTab can open. gp3-5 are binary, gpx/gp are zipped XML. */
export const IMPORT_EXTENSIONS = ['gp3', 'gp4', 'gp5', 'gpx', 'gp']
export const IMPORT_ACCEPT = IMPORT_EXTENSIONS.map((e) => `.${e}`).join(',')

const ID_PREFIX = 'imported-'

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
  /** The file contents for an imported id, or undefined if unknown. */
  getBytes: (id: string) => ArrayBuffer | undefined
}

function toEntry(record: ImportedRecord): TabEntry {
  return {
    id: record.id,
    title: record.title,
    artist: record.artist,
    ext: record.ext,
    file: '',
    imported: true,
  }
}

function newId(): string {
  const uuid =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return `${ID_PREFIX}${uuid}`
}

/**
 * Parse the file once, on the main thread, to pick up the title and artist
 * it carries. Throws if alphaTab cannot read it, which is the import's
 * validation step: a file that fails here would fail in the viewer too.
 */
function readMetadata(bytes: ArrayBuffer): { title: string; artist: string } {
  const settings = new alphaTab.Settings()
  // Same reason as in score/settings.ts: GP3-5 store Windows-1252.
  settings.importer.encoding = 'windows-1252'
  const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(new Uint8Array(bytes), settings)
  return { title: score.title.trim(), artist: score.artist.trim() }
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
    meta = readMetadata(bytes)
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

/**
 * User-imported pieces, persisted in IndexedDB so they survive a reload.
 *
 * The bytes stay in memory alongside the list: they are small (a few hundred
 * KB at most), and it keeps loading a piece synchronous and simple.
 */
export function useImportedTabs(): UseImportedTabs {
  const [imported, setImported] = useState<TabEntry[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bytesRef = useRef(new Map<string, ArrayBuffer>())

  useEffect(() => {
    let cancelled = false
    listImported()
      .then((records) => {
        if (cancelled) return
        records.sort((a, b) => a.addedAt - b.addedAt)
        for (const r of records) bytesRef.current.set(r.id, r.bytes)
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
    const added: TabEntry[] = []
    const failures: string[] = []

    for (const file of files) {
      try {
        const record = await toRecord(file)
        await putImported(record)
        bytesRef.current.set(record.id, record.bytes)
        added.push(toEntry(record))
      } catch (e) {
        failures.push(errorMessage(e))
      }
    }

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
    bytesRef.current.delete(id)
    setImported((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const getBytes = useCallback((id: string) => bytesRef.current.get(id), [])

  return { imported, ready, error, importFiles, removeImported, getBytes }
}
