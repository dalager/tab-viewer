import { useCallback, useEffect, useRef, useState } from 'react'
import { deleteLocalSongbook, isLocalBook, storeLocalSongbook } from '@/lib/localSongbooks'
import { parseLocation } from '@/lib/permalink'
import { absoluteBookUrl, fetchSongbook, type Songbook } from '@/lib/songbook'
import { errorMessage } from '@/lib/utils'

const ACTIVE_KEY = 'tab-viewer:songbook'
const REMEMBERED_KEY = 'tab-viewer:songbooks'

export interface RememberedBook {
  url: string
  name: string
}

export interface UseSongbooks {
  /** The loaded songbook, or null when none is. */
  active: Songbook | null
  /** Books loaded before, most recent first. */
  remembered: RememberedBook[]
  /** True while a book is being fetched, including the one to start with. */
  loading: boolean
  /** Last failure message, cleared by the next successful load. */
  error: string | null
  /** Fetches and activates a book. Resolves to it, or null if it failed or was superseded. */
  load: (url: string) => Promise<Songbook | null>
  /** Stores a .sbk file in this browser and loads it, like `load`. */
  openFile: (file: File) => Promise<Songbook | null>
  /** Drops the active book; it stays in the remembered list. */
  unload: () => void
  /** Removes a book from the remembered list, unloading it if it is the active one. A book opened from a file is deleted from this browser. */
  forget: (url: string) => void
  /** Unloads and forgets every book. */
  clearAll: () => void
}

function loadRemembered(): RememberedBook[] {
  try {
    const raw = localStorage.getItem(REMEMBERED_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (b): b is RememberedBook => typeof b?.url === 'string' && typeof b?.name === 'string',
    )
  } catch {
    return []
  }
}

/** A `?book=` link wins over the book left open last session. */
function initialBookUrl(): string | null {
  return parseLocation().book ?? localStorage.getItem(ACTIVE_KEY)
}

/** The active songbook and the history of ones loaded before, kept in localStorage. */
export function useSongbooks(): UseSongbooks {
  const [initialUrl] = useState(initialBookUrl)
  const [active, setActive] = useState<Songbook | null>(null)
  const [remembered, setRemembered] = useState<RememberedBook[]>(loadRemembered)
  const [loading, setLoading] = useState(initialUrl !== null)
  const [error, setError] = useState<string | null>(null)

  // Guards against a slow response overwriting a book picked after it.
  const loadToken = useRef(0)
  // Set alongside `active`, so the previous book can be released synchronously.
  const activeRef = useRef<Songbook | null>(null)

  useEffect(() => {
    localStorage.setItem(REMEMBERED_KEY, JSON.stringify(remembered))
  }, [remembered])

  /**
   * Fetch and activate, ignoring the result if a newer request superseded it.
   * Callers flag `loading` themselves; the startup effect must not set state
   * synchronously, so this only touches state once the fetch has settled.
   */
  const run = useCallback((url: string): Promise<Songbook | null> => {
    const token = ++loadToken.current
    const current = () => token === loadToken.current
    return fetchSongbook(url)
      .then((book) => {
        if (!current()) {
          book.release()
          return null
        }
        activeRef.current?.release()
        activeRef.current = book
        setActive(book)
        setError(null)
        localStorage.setItem(ACTIVE_KEY, book.url)
        setRemembered((prev) => [
          { url: book.url, name: book.name },
          ...prev.filter((b) => b.url !== book.url),
        ])
        return book
      })
      .catch((e: unknown) => {
        if (current()) setError(`Could not load songbook: ${errorMessage(e)}`)
        return null
      })
      .finally(() => {
        if (current()) setLoading(false)
      })
  }, [])

  const load = useCallback(
    (url: string) => {
      // Already open: nothing to fetch, and re-parsing would reload the score.
      const open = activeRef.current
      if (open && absoluteBookUrl(url) === open.url) {
        return Promise.resolve(open)
      }
      setLoading(true)
      return run(url)
    },
    [run],
  )

  const openFile = useCallback(
    async (file: File) => {
      setLoading(true)
      let url: string
      try {
        url = await storeLocalSongbook(file)
      } catch (e) {
        setLoading(false)
        setError(`Could not store ${file.name}: ${errorMessage(e)}`)
        return null
      }
      return run(url)
    },
    [run],
  )

  // The book to start with. `loading` was initialised to true for it.
  useEffect(() => {
    if (initialUrl) void run(initialUrl)
  }, [initialUrl, run])

  const unload = useCallback(() => {
    loadToken.current++
    activeRef.current?.release()
    activeRef.current = null
    setLoading(false)
    setActive(null)
    setError(null)
    localStorage.removeItem(ACTIVE_KEY)
  }, [])

  const forget = useCallback(
    (url: string) => {
      if (url === activeRef.current?.url) unload()
      if (isLocalBook(url)) void deleteLocalSongbook(url).catch(() => {})
      setRemembered((prev) => prev.filter((b) => b.url !== url))
    },
    [unload],
  )

  const clearAll = useCallback(() => {
    unload()
    for (const b of remembered) {
      if (isLocalBook(b.url)) void deleteLocalSongbook(b.url).catch(() => {})
    }
    setRemembered([])
  }, [unload, remembered])

  return { active, remembered, loading, error, load, openFile, unload, forget, clearAll }
}
