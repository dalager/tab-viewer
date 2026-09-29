import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isLocalBook } from '@/lib/localSongbooks'
import { type Permalink, parseLocation, piecePath } from '@/lib/permalink'
import {
  isImported,
  type PieceRef,
  type PieceTarget,
  parsePieceKey,
  pieceKey,
  sameTarget,
} from '@/lib/pieces'
import type { Songbook } from '@/lib/songbook'
import type { TabEntry } from '@/types'

const STORAGE_KEY = 'tab-viewer:selected'

/** A bar (1-based) to jump to once the given piece has rendered. */
interface PendingBar {
  target: PieceTarget
  bar: number
}

/** The piece a link names, if any; `book` is null for a link without `?book=`. */
function targetOf({ id, book }: Permalink): PieceTarget | null {
  return id ? { id, book } : null
}

/** The bar a link asks for, with the piece it is in. */
function pendingBarOf(link: Permalink): PendingBar | null {
  const target = targetOf(link)
  return target && link.bar ? { target, bar: link.bar } : null
}

/** Whether a link's bar can be applied now: its piece is open and has rendered. */
function isDue(
  pending: PendingBar | null,
  renderVersion: number,
  open: PieceTarget | null,
): pending is PendingBar {
  return pending !== null && renderVersion > 0 && sameTarget(pending.target, open)
}

/** The songbook a piece's link names; imports have none. */
function linkedBook(piece: TabEntry | null): string | null {
  return piece && !isImported(piece) ? piece.book : null
}

/** Why the piece cannot be shared by link, or null when it can. */
function linkBlockedReason(piece: TabEntry | null): string | null {
  if (!piece) return 'No piece is open'
  if (isImported(piece)) return 'Imported pieces live only in this browser, so they cannot be linked'
  if (isLocalBook(piece.book)) {
    return 'This songbook was opened from a file, so its pieces cannot be linked'
  }
  return null
}

/** Just the book and id, without the rest of the entry. */
function refOf(piece: PieceRef): PieceRef {
  return { book: piece.book, id: piece.id }
}

/** The first songbook piece, else the first import: what to show instead of nothing. */
function fallbackPiece(tabs: TabEntry[]): TabEntry | undefined {
  return tabs.find((t) => !isImported(t)) ?? tabs[0]
}

/**
 * The piece a freshly loaded book opens: the open piece's id in the new book
 * if it has one (a copy of the same book, say), else its first piece.
 */
function pieceAfterLoad(loaded: Songbook, open: PieceTarget | null): PieceTarget | null {
  if (open && loaded.tabs.some((t) => t.id === open.id)) return { id: open.id, book: loaded.url }
  const first = loaded.tabs[0]
  return first ? refOf(first) : null
}

/** The piece `offset` steps from `index`, wrapping around; undefined without pieces. */
function neighbour(tabs: TabEntry[], index: number, offset: 1 | -1): TabEntry | undefined {
  if (tabs.length === 0) return undefined
  const base = Math.max(index, 0)
  return tabs[(base + offset + tabs.length) % tabs.length]
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
  const shown = targetOf(current)
  const known = tabs.some((t) => sameTarget(t, shown))
  if (known) window.history.pushState(null, '', target)
  else window.history.replaceState(null, '', target)
}

/**
 * The bar a link asked for. It is applied once, on the first render of its
 * piece, so later re-renders (zoom, tracks, layout) leave the reader where they are.
 */
function usePendingBar(
  startLink: Permalink,
  target: PieceTarget | null,
  renderVersion: number,
  seekToBar: (index: number) => void,
) {
  const pendingBar = useRef<PendingBar | null>(pendingBarOf(startLink))

  // Read by effects that must not re-run when it changes: a new selection
  // must wait for its own render before a pending bar can be applied to it.
  const targetRef = useRef(target)
  useEffect(() => {
    targetRef.current = target
  }, [target])

  useEffect(() => {
    const pending = pendingBar.current
    if (!isDue(pending, renderVersion, targetRef.current)) return
    pendingBar.current = null
    seekToBar(pending.bar - 1)
  }, [renderVersion, seekToBar])

  return { pendingBar, targetRef }
}

interface PopContext {
  pendingBar: RefObject<PendingBar | null>
  targetRef: RefObject<PieceTarget | null>
  bookUrlRef: RefObject<string | null>
  select: (target: PieceTarget) => void
  loadBook: (url: string) => Promise<unknown>
  seekToBar: (index: number) => void
}

/** Whether the address names a songbook other than the open one. */
function isOtherBook(book: string | null, open: string | null): book is string {
  return book !== null && book !== open
}

/** Back/Forward landed: select the piece in the address, loading its songbook first if needed. */
function followPop(ctx: PopContext): void {
  const link = parseLocation()
  const target = targetOf(link)
  if (!target) return
  const { book } = target
  const pending = pendingBarOf(link)
  if (!isOtherBook(book, ctx.bookUrlRef.current) && sameTarget(target, ctx.targetRef.current)) {
    // Same piece, already rendered: nothing will re-render, so jump now.
    ctx.pendingBar.current = null
    if (pending) ctx.seekToBar(pending.bar - 1)
    return
  }
  ctx.pendingBar.current = pending
  ctx.select(target)
  if (isOtherBook(book, ctx.bookUrlRef.current)) void ctx.loadBook(book)
}

type PopStateOptions = Omit<PopContext, 'bookUrlRef'> & { bookUrl: string | null }

function usePopState({ bookUrl, ...rest }: PopStateOptions) {
  const bookUrlRef = useRef(bookUrl)
  useEffect(() => {
    bookUrlRef.current = bookUrl
  }, [bookUrl])

  const { pendingBar, targetRef, select, loadBook, seekToBar } = rest
  useEffect(() => {
    const ctx = { pendingBar, targetRef, bookUrlRef, select, loadBook, seekToBar }
    const onPopState = () => followPop(ctx)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [pendingBar, targetRef, select, loadBook, seekToBar])
}

/** The piece open last time, as stored; older versions stored a bare id. */
function storedTarget(): PieceTarget | null {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored ? parsePieceKey(stored) : null
}

/** The piece to open: the one the start link names, or else the one open last time. */
function useTarget(startLink: Permalink) {
  const [target, setTarget] = useState<PieceTarget | null>(
    () => targetOf(startLink) ?? storedTarget(),
  )
  const select = useCallback((piece: PieceTarget) => {
    setTarget({ id: piece.id, book: piece.book })
  }, [])
  return { target, setTarget, select }
}

/**
 * The piece to switch to when the selection is missing once everything has
 * loaded, or undefined to keep it. A remembered selection may point at an
 * import since removed, or at a piece in a songbook that was unloaded.
 */
function fallbackFor(
  settled: boolean,
  selected: TabEntry | null,
  target: PieceTarget | null,
  tabs: TabEntry[],
): PieceTarget | null | undefined {
  if (!settled || selected) return undefined
  const fallback = fallbackPiece(tabs)
  if (fallback) return refOf(fallback)
  return target === null ? undefined : null
}

/** What a link to the piece names, or null when it cannot be linked. */
function linkOf(piece: TabEntry | null, blocked: string | null): PieceRef | null {
  return piece && !blocked ? refOf(piece) : null
}

interface PieceSelectionOptions {
  /** What the address named when the app started: a piece, a bar and its book. */
  startLink: Permalink
  /** Every piece on offer, from every book. */
  tabs: TabEntry[]
  /** URL of the loaded songbook, which Back/Forward compares links against. */
  bookUrl: string | null
  /**
   * True once imports and the book to start with have finished loading (or
   * failed); until then a missing piece may still be on its way.
   */
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
  const { startLink, tabs, bookUrl, settled, loadBook, renderVersion, seekToBar } = options
  const { target, setTarget, select } = useTarget(startLink)
  const selectedIndex = useMemo(() => tabs.findIndex((t) => sameTarget(t, target)), [tabs, target])
  const selected = tabs[selectedIndex] ?? null
  const selectedBook = linkedBook(selected)

  // Fall back rather than show nothing once imports and the songbook have
  // settled. Adjusted during render so it settles in the same pass.
  const fallback = fallbackFor(settled, selected, target, tabs)
  if (fallback !== undefined) setTarget(fallback)

  const { pendingBar, targetRef } = usePendingBar(startLink, target, renderVersion, seekToBar)

  // Stored with its book, so it reopens in the right one.
  useEffect(() => {
    if (selected) localStorage.setItem(STORAGE_KEY, pieceKey(selected))
  }, [selected])

  useEffect(() => {
    if (settled) syncAddressBar(selected, selectedBook, tabs)
  }, [settled, selected, selectedBook, tabs])

  usePopState({ bookUrl, pendingBar, targetRef, select, loadBook, seekToBar })

  // Jumping regardless of the open piece would load a second piece while the
  // first is still rendering.
  const onBookLoaded = useCallback((loaded: Songbook) => {
    setTarget((open) => pieceAfterLoad(loaded, open))
  }, [setTarget])

  const goToPiece = useCallback(
    (offset: 1 | -1) => {
      const next = neighbour(tabs, selectedIndex, offset)
      if (next) select(next)
    },
    [tabs, selectedIndex, select],
  )

  const linkBlocked = linkBlockedReason(selected)
  const link = useMemo(() => linkOf(selected, linkBlocked), [selected, linkBlocked])

  return {
    select,
    selected,
    selectedKey: selected ? pieceKey(selected) : null,
    link,
    linkBlocked,
    onBookLoaded,
    goToPiece,
  }
}
