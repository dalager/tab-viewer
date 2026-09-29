import { useCallback, useEffect, useRef, useState } from 'react'
import { deleteLocalSongbook, isLocalBook, storeLocalSongbook } from '@/lib/localSongbooks'
import { parseLocation } from '@/lib/permalink'
import {
  absoluteBookUrl,
  FIRST_VISIT_SONGBOOK,
  fetchSongbook,
  type Songbook,
} from '@/lib/songbook'
import { errorMessage } from '@/lib/utils'

const ACTIVE_KEY = 'tab-viewer:songbook'
const REMEMBERED_KEY = 'tab-viewer:songbooks'
/** Set once the app has run in this browser; its absence means a first visit. */
const VISITED_KEY = 'tab-viewer:visited'

export interface RememberedBook {
  url: string
  name: string
  description?: string
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

/**
 * A `?book=` link wins over the book left open last session. A first visit
 * with neither opens the bundled book; after that, an unloaded book stays
 * unloaded. Browsers that used the app before this marker existed count as
 * visited if they remember any book.
 */
function initialBookUrl(): string | null {
  const firstVisit =
    localStorage.getItem(VISITED_KEY) === null && localStorage.getItem(REMEMBERED_KEY) === null
  return (
    parseLocation().book ??
    localStorage.getItem(ACTIVE_KEY) ??
    (firstVisit ? FIRST_VISIT_SONGBOOK : null)
  )
}

/** The remembered list with this book moved (or added) to the front. */
function rememberFirst(list: RememberedBook[], book: Songbook): RememberedBook[] {
  const entry = { url: book.url, name: book.name, description: book.description }
  return [entry, ...list.filter((b) => b.url !== book.url)]
}

/** Deletes a book opened from a file from this browser; other books have nothing stored. */
function deleteIfLocal(url: string): void {
  if (isLocalBook(url)) void deleteLocalSongbook(url).catch(() => {})
}

/** Whether `url` names the book that is already open. */
function isOpen(open: Songbook | null, url: string): open is Songbook {
  return open !== null && absoluteBookUrl(url) === open.url
}

/**
 * Books loaded before, most recent first, kept in localStorage. Also marks
 * this browser as visited, which is what first-visit detection reads next to it.
 */
function useRememberedBooks() {
  const [remembered, setRemembered] = useState<RememberedBook[]>(loadRemembered)

  useEffect(() => {
    localStorage.setItem(VISITED_KEY, '1')
  }, [])

  useEffect(() => {
    localStorage.setItem(REMEMBERED_KEY, JSON.stringify(remembered))
  }, [remembered])

  const remember = useCallback((book: Songbook) => {
    setRemembered((prev) => rememberFirst(prev, book))
  }, [])

  const drop = useCallback((url: string) => {
    deleteIfLocal(url)
    setRemembered((prev) => prev.filter((b) => b.url !== url))
  }, [])

  const dropAll = useCallback(() => {
    for (const b of remembered) deleteIfLocal(b.url)
    setRemembered([])
  }, [remembered])

  return { remembered, remember, drop, dropAll }
}

/** How a load ended, or null when a newer request superseded it. */
type LoadOutcome = { book: Songbook } | { error: string } | null

/** Fetches a book, releasing it straight away if `isCurrent` says it was superseded. */
async function loadLatest(url: string, isCurrent: () => boolean): Promise<LoadOutcome> {
  try {
    const book = await fetchSongbook(url)
    if (isCurrent()) return { book }
    book.release()
    return null
  } catch (e) {
    return isCurrent() ? { error: `Could not load songbook: ${errorMessage(e)}` } : null
  }
}

/** Stores a .sbk in this browser, resolving to its book URL or a message saying why not. */
async function storeBookFile(file: File): Promise<{ url: string } | { error: string }> {
  try {
    return { url: await storeLocalSongbook(file) }
  } catch (e) {
    return { error: `Could not store ${file.name}: ${errorMessage(e)}` }
  }
}

/** The open book. Replacing it releases the previous one and records the choice. */
function useActiveBook() {
  const [active, setActive] = useState<Songbook | null>(null)
  // Set alongside `active`, so the previous book can be released synchronously.
  const activeRef = useRef<Songbook | null>(null)

  const replace = useCallback((book: Songbook | null) => {
    activeRef.current?.release()
    activeRef.current = book
    setActive(book)
    if (book) localStorage.setItem(ACTIVE_KEY, book.url)
    else localStorage.removeItem(ACTIVE_KEY)
  }, [])

  return { active, activeRef, replace }
}

/** The active songbook and the history of ones loaded before, kept in localStorage. */
export function useSongbooks(): UseSongbooks {
  const [initialUrl] = useState(initialBookUrl)
  const { active, activeRef, replace } = useActiveBook()
  const { remembered, remember, drop, dropAll } = useRememberedBooks()
  const [loading, setLoading] = useState(initialUrl !== null)
  const [error, setError] = useState<string | null>(null)

  // Guards against a slow response overwriting a book picked after it.
  const loadToken = useRef(0)

  /**
   * Fetch and activate, ignoring the result if a newer request superseded it.
   * Callers flag `loading` themselves; the startup effect must not set state
   * synchronously, so this only touches state once the fetch has settled.
   */
  const run = useCallback(
    async (url: string): Promise<Songbook | null> => {
      const token = ++loadToken.current
      const outcome = await loadLatest(url, () => token === loadToken.current)
      if (!outcome) return null
      setLoading(false)
      if ('error' in outcome) {
        setError(outcome.error)
        return null
      }
      replace(outcome.book)
      setError(null)
      remember(outcome.book)
      return outcome.book
    },
    [replace, remember],
  )

  const load = useCallback(
    (url: string) => {
      // Already open: nothing to fetch, and re-parsing would reload the score.
      const open = activeRef.current
      if (isOpen(open, url)) return Promise.resolve(open)
      setLoading(true)
      return run(url)
    },
    [activeRef, run],
  )

  const openFile = useCallback(
    async (file: File) => {
      setLoading(true)
      const stored = await storeBookFile(file)
      if ('url' in stored) return run(stored.url)
      setLoading(false)
      setError(stored.error)
      return null
    },
    [run],
  )

  // The book to start with. `loading` was initialised to true for it.
  useEffect(() => {
    if (initialUrl) void run(initialUrl)
  }, [initialUrl, run])

  const unload = useCallback(() => {
    loadToken.current++
    replace(null)
    setLoading(false)
    setError(null)
  }, [replace])

  const forget = useCallback(
    (url: string) => {
      if (url === activeRef.current?.url) unload()
      drop(url)
    },
    [activeRef, unload, drop],
  )

  const clearAll = useCallback(() => {
    unload()
    dropAll()
  }, [unload, dropAll])

  return { active, remembered, loading, error, load, openFile, unload, forget, clearAll }
}
