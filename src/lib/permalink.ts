/**
 * Permanent links: `/p/<id>` for a piece, `/p/<id>?bar=<n>` for a spot in it.
 *
 * `bar` is 1-based, matching the bar numbers printed in the score.
 */

const PIECE_PATH = /^\/p\/([a-z0-9-]+)\/?$/

export interface Permalink {
  id: string | null
  bar: number | null
}

export function parseLocation(loc: Location = window.location): Permalink {
  const id = PIECE_PATH.exec(loc.pathname)?.[1] ?? null
  const raw = new URLSearchParams(loc.search).get('bar')
  const bar = raw && /^\d+$/.test(raw) ? Number(raw) : null
  return { id, bar: bar && bar > 0 ? bar : null }
}

export function piecePath(id: string, bar?: number | null): string {
  return bar ? `/p/${id}?bar=${bar}` : `/p/${id}`
}

export function pieceUrl(id: string, bar?: number | null): string {
  return `${window.location.origin}${piecePath(id, bar)}`
}
