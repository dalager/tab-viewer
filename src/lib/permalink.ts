/**
 * Permanent links: `/p/<id>` for a piece, `/p/<id>?bar=<n>` for a spot in it,
 * and `&book=<manifest url>` to say which songbook it lives in.
 *
 * `bar` is 1-based, matching the bar numbers printed in the score. A link
 * without `book` resolves against whichever songbook is loaded.
 *
 * `?addcollection=<url>` on any address adds that collection of songbooks to
 * this browser's list; the app takes it out of the address once it has read it.
 */

import { absoluteBookUrl, shortBookUrl } from '@/lib/songbook'

const PIECE_PATH = /^\/p\/([a-z0-9-]+)\/?$/

export interface Permalink {
  id: string | null
  bar: number | null
  /** Absolute songbook manifest URL, resolved from the site-relative form links use. */
  book: string | null
}

export function parseLocation(loc: Location = window.location): Permalink {
  const id = PIECE_PATH.exec(loc.pathname)?.[1] ?? null
  const params = new URLSearchParams(loc.search)
  const raw = params.get('bar')
  const bar = raw && /^\d+$/.test(raw) ? Number(raw) : null
  let book: string | null = null
  try {
    const raw = params.get('book')
    book = raw ? absoluteBookUrl(raw) : null
  } catch {
    // A malformed book link is treated as no book at all.
  }
  return { id, bar: bar && bar > 0 ? bar : null, book }
}

const ADD_COLLECTION = 'addcollection'

/** The collection a link asks to add, as written, or null when it names none. */
export function addCollectionParam(loc: Pick<Location, 'search'> = window.location): string | null {
  return new URLSearchParams(loc.search).get(ADD_COLLECTION)?.trim() || null
}

/** The address without its `addcollection`, for the address bar once it has been read. */
export function withoutAddCollection(
  loc: Pick<Location, 'pathname' | 'search' | 'hash'> = window.location,
): string {
  const params = new URLSearchParams(loc.search)
  params.delete(ADD_COLLECTION)
  const query = params.toString()
  return `${loc.pathname}${query ? `?${query}` : ''}${loc.hash}`
}

/** Query-safe, but leaves `/` and `:` readable: `?book=/songbooks/bach/songbook.json`. */
function encodeParam(value: string): string {
  return encodeURIComponent(value).replace(/%2F/gi, '/').replace(/%3A/gi, ':')
}

export function piecePath(id: string, bar?: number | null, book?: string | null): string {
  const params: string[] = []
  if (book) params.push(`book=${encodeParam(shortBookUrl(book))}`)
  if (bar) params.push(`bar=${bar}`)
  return params.length > 0 ? `/p/${id}?${params.join('&')}` : `/p/${id}`
}

export function pieceUrl(id: string, bar?: number | null, book?: string | null): string {
  return `${window.location.origin}${piecePath(id, bar, book)}`
}
