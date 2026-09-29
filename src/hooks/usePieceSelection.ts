import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isLocalBook } from '@/lib/localSongbooks'
import { parseLocation, piecePath } from '@/lib/permalink'
import type { Songbook } from '@/lib/songbook'
import type { TabEntry } from '@/types'

const STORAGE_KEY = 'tab-viewer:selected'

/** A bar (1-based) to jump to once the given piece has rendered. */
interface PendingBar {
  id: string
  bar: number
}

/** A piece and the songbook it lives in, which is what a link names. */
export interface PieceLink {
  id: string
  book: string | null
}

function pendingBarFrom(loc: Location): PendingBar | null {
  const { id, bar } = parseLocation(loc)
  return id && bar ? { id, bar } : null
}

/** Whether a link's bar can be applied now: its piece is open and has rendered. */
function isDue(
  pending: PendingBar | null,
  renderVersion: number,
  openId: string | null,
): pending is PendingBar {
  return pending !== null && renderVersion > 0 && pending.id === openId
}

/** Every piece that is not an import belongs to the one loaded songbook. */
function bookOfPiece(piece: TabEntry | null, book: Songbook | null): string | null {
  if (!piece || piece.imported) return null
  return book?.url ?? null
}

/** Why the piece cannot be shared by link, or null when it can. */
function linkBlockedReason(piece: TabEntry | null, book: string | null): string | null {
  if (!piece) return 'No piece is open'
  if (piece.imported) return 'Imported pieces live only in this browser, so they cannot be linked'
  if (book && isLocalBook(book)) {
    return 'This songbook was opened from a file, so its pieces cannot be linked'
  }
  return null
}

/** The songbook's first piece, else the first import: what to show instead of nothing. */
function fallbackPiece(tabs: TabEntry[]): string | null {
  return (tabs.find((t) => !t.imported) ?? tabs[0])?.id ?? null
}

/** The piece a freshly loaded book opens: the open one if it has it, else its first. */
function pieceAfterLoad(loaded: Songbook, open: string | null): string | null {
  return loaded.tabs.some((t) => t.id === open) ? open : (loaded.tabs[0]?.id ?? null)
}

/** The piece `offset` steps from `index`, wrapping around; null without pieces. */
function neighbour(tabs: TabEntry[], index: number, offset: 1 | -1): string | null {
  if (tabs.length === 0) return null
  const base = Math.max(index, 0)
  return tabs[(base + offset + tabs.length) % tabs.length].id
}

/**
 * Keep the address bar a permalink to the open piece. Moving between known
 * pieces adds history entries; landing on "/" or on a slug that no longer
 * exists is corrected in place instead, so Back does not return to it. With
 * nothing open (no songbook, no imports) the address goes back to "/".
 */
function syncAddressBar(piece: TabEntry | null, book: string | null, tabs: TabEntry[]): void {
  if (!piece) {
    if (window.location.pathname !== '/') window.history.replaceState(null, '', '/')
    return
  }
  const current = parseLocation()
  if (current.id === piece.id && current.book === book) return
  const target = piecePath(piece.id, null, book)
  const known = tabs.some((t) => t.id === current.id)
  if (known) window.history.pushState(null, '', target)
  else window.history.replaceState(null, '', target)
}

/**
 * The bar a link asked for. It is applied once, on the first render of its
 * piece, so later re-renders (zoom, tracks, layout) leave the reader where they are.
 */
function usePendingBar(
  selectedId: string | null,
  renderVersion: number,
  seekToBar: (index: number) => void,
) {
  const pendingBar = useRef<PendingBar | null>(pendingBarFrom(window.location))

  // Read by effects that must not re-run when it changes: a new selection
  // must wait for its own render before a pending bar can be applied to it.
  const selectedIdRef = useRef(selectedId)
  useEffect(() => {
    selectedIdRef.current = selectedId
  }, [selectedId])

  useEffect(() => {
    const pending = pendingBar.current
    if (!isDue(pending, renderVersion, selectedIdRef.current)) return
    pendingBar.current = null
    seekToBar(pending.bar - 1)
  }, [renderVersion, seekToBar])

  return { pendingBar, selectedIdRef }
}

interface PopContext {
  pendingBar: RefObject<PendingBar | null>
  selectedIdRef: RefObject<string | null>
  bookUrlRef: RefObject<string | null>
  select: (id: string) => void
  loadBook: (url: string) => Promise<unknown>
  seekToBar: (index: number) => void
}

/** Whether the address names a songbook other than the open one. */
function isOtherBook(book: string | null, open: string | null): book is string {
  return book !== null && book !== open
}

/** Back/Forward landed: select the piece in the address, loading its songbook first if needed. */
function followPop(ctx: PopContext): void {
  const { id, book } = parseLocation()
  if (!id) return
  const pending = pendingBarFrom(window.location)
  if (!isOtherBook(book, ctx.bookUrlRef.current) && id === ctx.selectedIdRef.current) {
    // Same piece, already rendered: nothing will re-render, so jump now.
    ctx.pendingBar.current = null
    if (pending) ctx.seekToBar(pending.bar - 1)
    return
  }
  ctx.pendingBar.current = pending
  ctx.select(id)
  if (isOtherBook(book, ctx.bookUrlRef.current)) void ctx.loadBook(book)
}

type PopStateOptions = Omit<PopContext, 'bookUrlRef'> & { bookUrl: string | null }

function usePopState({ bookUrl, ...rest }: PopStateOptions) {
  const bookUrlRef = useRef(bookUrl)
  useEffect(() => {
    bookUrlRef.current = bookUrl
  }, [bookUrl])

  const { pendingBar, selectedIdRef, select, loadBook, seekToBar } = rest
  useEffect(() => {
    const ctx = { pendingBar, selectedIdRef, bookUrlRef, select, loadBook, seekToBar }
    const onPopState = () => followPop(ctx)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [pendingBar, selectedIdRef, select, loadBook, seekToBar])
}

/** The open piece's id, starting from the address or else the one open last time. */
function useStoredSelection() {
  const [selectedId, setSelectedId] = useState<string | null>(
    () => parseLocation().id ?? localStorage.getItem(STORAGE_KEY),
  )
  useEffect(() => {
    if (selectedId) localStorage.setItem(STORAGE_KEY, selectedId)
  }, [selectedId])
  return [selectedId, setSelectedId] as const
}

/**
 * The piece to switch to when the selection is missing once everything has
 * loaded, or undefined to keep it. A remembered selection may point at an
 * import since removed, or at a piece in a songbook that was unloaded.
 */
function fallbackFor(
  settled: boolean,
  selected: TabEntry | null,
  selectedId: string | null,
  tabs: TabEntry[],
): string | null | undefined {
  if (!settled || selected) return undefined
  const fallback = fallbackPiece(tabs)
  return fallback === selectedId ? undefined : fallback
}

/** What a link to the piece names, or null when it cannot be linked. */
function linkOf(piece: TabEntry | null, book: string | null, blocked: string | null) {
  return piece && !blocked ? { id: piece.id, book } : null
}

interface PieceSelectionOptions {
  /** Every piece on offer: imports first, then the loaded songbook's. */
  tabs: TabEntry[]
  book: Songbook | null
  /** True once imports and the songbook have finished loading. */
  settled: boolean
  loadBook: (url: string) => Promise<unknown>
  renderVersion: number
  seekToBar: (index: number) => void
}

/**
 * Which piece is open, kept in step with the address bar, the browser
 * history and localStorage, including bar links and Back/Forward.
 */
export function usePieceSelection(options: PieceSelectionOptions) {
  const { tabs, book, settled, loadBook, renderVersion, seekToBar } = options
  const [selectedId, setSelectedId] = useStoredSelection()
  const selectedIndex = useMemo(
    () => tabs.findIndex((t) => t.id === selectedId),
    [tabs, selectedId],
  )
  const selected = tabs[selectedIndex] ?? null
  const selectedBook = bookOfPiece(selected, book)

  // Fall back rather than show nothing once imports and the songbook have
  // settled. Adjusted during render so it settles in the same pass.
  const fallback = fallbackFor(settled, selected, selectedId, tabs)
  if (fallback !== undefined) setSelectedId(fallback)

  const { pendingBar, selectedIdRef } = usePendingBar(selectedId, renderVersion, seekToBar)

  useEffect(() => {
    if (settled) syncAddressBar(selected, selectedBook, tabs)
  }, [settled, selected, selectedBook, tabs])

  usePopState({
    bookUrl: book?.url ?? null,
    pendingBar,
    selectedIdRef,
    select: setSelectedId,
    loadBook,
    seekToBar,
  })

  // A freshly loaded songbook stays on the open piece if it has one by that id
  // (a copy of the same book, say), else opens on its first piece. Jumping
  // regardless would load a second piece while the first is still rendering.
  const onBookLoaded = useCallback((loaded: Songbook) => {
    setSelectedId((open) => pieceAfterLoad(loaded, open))
  }, [setSelectedId])

  const goToPiece = useCallback(
    (offset: 1 | -1) => {
      const next = neighbour(tabs, selectedIndex, offset)
      if (next) setSelectedId(next)
    },
    [tabs, selectedIndex, setSelectedId],
  )

  const linkBlocked = linkBlockedReason(selected, selectedBook)
  const link = useMemo<PieceLink | null>(
    () => linkOf(selected, selectedBook, linkBlocked),
    [selected, linkBlocked, selectedBook],
  )

  return {
    selectedId,
    select: setSelectedId,
    selected,
    selectedBook,
    link,
    linkBlocked,
    onBookLoaded,
    goToPiece,
  }
}
