/**
 * Songbooks: a JSON manifest, hosted at any URL, listing Guitar Pro files.
 *
 *   { "songbook": 1, "name": "…", "songs": [{ "url": "tabs/air.gp5", "title": "Air" }] }
 *
 * Song URLs resolve against the manifest's own URL, so a folder holding
 * songbook.json and its files is a complete, self-contained songbook.
 */

import type { TabEntry } from '@/types'

export interface Songbook {
  /** Absolute manifest URL; the book's identity. */
  url: string
  name: string
  tabs: TabEntry[]
}

/**
 * Books offered with one click. The bundled Bach collection is built into
 * public/songbooks/ by scripts/build-manifest.mjs; this is the only place
 * the app knows it exists.
 */
export const SUGGESTED_SONGBOOKS = [
  { name: 'Bach Guitar Songbook', url: '/songbooks/bach/songbook.json' },
]

/** Resolve a user- or link-supplied book URL against this site. */
export function absoluteBookUrl(url: string): string {
  return new URL(url, window.location.origin).href
}

/** Shortest form of a book URL for links: a path when it lives on this site. */
export function shortBookUrl(url: string): string {
  const parsed = new URL(url, window.location.origin)
  return parsed.origin === window.location.origin
    ? `${parsed.pathname}${parsed.search}`
    : parsed.href
}

/** ASCII slug for songs whose manifest entry has no `id`: "Suite Nº1" -> "suite-no1". */
function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function fileStem(url: URL): string {
  const last = decodeURIComponent(url.pathname.split('/').pop() ?? '')
  return last.replace(/\.[^.]+$/, '')
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Validate a parsed manifest and turn its songs into sidebar entries. */
function parseSongbook(json: unknown, manifestUrl: string): Songbook {
  if (!isRecord(json)) throw new Error('not a songbook: expected a JSON object')
  if (!Array.isArray(json.songs)) throw new Error('not a songbook: missing a "songs" list')

  const seen = new Map<string, number>()
  const tabs = json.songs.map((song, i): TabEntry => {
    const where = `song ${i + 1}`
    if (!isRecord(song)) throw new Error(`${where}: expected an object`)
    const rawUrl = optionalString(song.url)
    if (!rawUrl) throw new Error(`${where}: missing "url"`)

    let url: URL
    try {
      url = new URL(rawUrl, manifestUrl)
    } catch {
      throw new Error(`${where}: invalid url "${rawUrl}"`)
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error(`${where}: only http(s) urls are supported`)
    }

    const stem = fileStem(url)
    const base = slugify(optionalString(song.id) ?? stem) || `song-${i + 1}`
    const count = (seen.get(base) ?? 0) + 1
    seen.set(base, count)

    return {
      id: count === 1 ? base : `${base}-${count}`,
      title: optionalString(song.title) ?? (stem || `Song ${i + 1}`),
      artist: optionalString(song.artist) ?? '',
      ext: url.pathname.split('.').pop()?.toLowerCase() ?? '',
      file: url.href,
    }
  })

  return {
    url: manifestUrl,
    name: optionalString(json.name) ?? new URL(manifestUrl).hostname,
    tabs,
  }
}

export async function fetchSongbook(url: string): Promise<Songbook> {
  let absolute: string
  try {
    absolute = absoluteBookUrl(url)
  } catch {
    throw new Error(`"${url}" is not a valid URL`)
  }

  let response: Response
  try {
    response = await fetch(absolute)
  } catch {
    // fetch rejects with an opaque TypeError for CORS and network failures.
    throw new Error(`could not reach ${absolute} (offline, or the host does not allow CORS)`)
  }
  if (!response.ok) throw new Error(`${absolute}: ${response.status} ${response.statusText}`)

  let json: unknown
  try {
    json = await response.json()
  } catch {
    throw new Error(`${absolute} is not JSON`)
  }
  return parseSongbook(json, absolute)
}
