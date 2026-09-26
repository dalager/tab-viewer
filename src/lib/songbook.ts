/**
 * Songbooks: a JSON manifest, hosted at any URL, listing Guitar Pro files.
 *
 *   { "songbook": 1, "name": "…", "songs": [{ "url": "tabs/air.gp5", "title": "Air" }] }
 *
 * Song URLs resolve against the manifest's own URL, so a folder holding
 * songbook.json and its files is a complete, self-contained songbook. The
 * same folder zipped is a .sbk (see sbk.ts), which loads in one request.
 */

import { isLocalBook, readLocalSongbook } from '@/lib/localSongbooks'
import { isZip, unpackSongbook } from '@/lib/sbk'
import type { TabEntry } from '@/types'

export interface Songbook {
  /** Absolute manifest or .sbk URL, or a `local:` one; the book's identity. */
  url: string
  name: string
  description?: string
  tabs: TabEntry[]
  /** Frees what the book holds in memory (a .sbk's blob URLs). Call when it is dropped. */
  release: () => void
}

/**
 * Song URLs inside a .sbk resolve against this placeholder origin; any that
 * still land on it are zip entries, and any that do not are ordinary links.
 */
const ZIP_ORIGIN = 'https://sbk.invalid'

/**
 * Books offered with one click. The bundled Bach collection is built into
 * public/songbooks/ by scripts/build-manifest.mjs; this is the only place
 * the app knows it exists.
 */
export const SUGGESTED_SONGBOOKS = [
  { name: 'Bach Guitar Songbook', url: '/songbooks/bach.sbk' },
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

/** ASCII slug for ids and file names: "Suite Nº1" -> "suite-no1". */
export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Hands out unique ids: the second "air" becomes "air-2", the third "air-3". */
export function idAllocator(): (base: string) => string {
  const seen = new Map<string, number>()
  return (base) => {
    const count = (seen.get(base) ?? 0) + 1
    seen.set(base, count)
    return count === 1 ? base : `${base}-${count}`
  }
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

/**
 * Validate a parsed manifest and turn its songs into sidebar entries. Song
 * URLs resolve against `resolveFrom`, which is the book URL except inside a .sbk.
 */
function parseSongbook(json: unknown, bookUrl: string, resolveFrom: string): Songbook {
  if (!isRecord(json)) throw new Error('not a songbook: expected a JSON object')
  if (!Array.isArray(json.songs)) throw new Error('not a songbook: missing a "songs" list')

  const uniqueId = idAllocator()
  const tabs = json.songs.map((song, i): TabEntry => {
    const where = `song ${i + 1}`
    if (!isRecord(song)) throw new Error(`${where}: expected an object`)
    const rawUrl = optionalString(song.url)
    if (!rawUrl) throw new Error(`${where}: missing "url"`)

    let url: URL
    try {
      url = new URL(rawUrl, resolveFrom)
    } catch {
      throw new Error(`${where}: invalid url "${rawUrl}"`)
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error(`${where}: only http(s) urls are supported`)
    }

    const stem = fileStem(url)
    const base = slugify(optionalString(song.id) ?? stem) || `song-${i + 1}`

    return {
      id: uniqueId(base),
      title: optionalString(song.title) ?? (stem || `Song ${i + 1}`),
      artist: optionalString(song.artist) ?? '',
      ext: url.pathname.split('.').pop()?.toLowerCase() ?? '',
      file: url.href,
    }
  })

  return {
    url: bookUrl,
    name: optionalString(json.name) ?? (new URL(bookUrl).hostname || 'Untitled songbook'),
    description: optionalString(json.description),
    tabs,
    release: () => {},
  }
}

/** Parse a .sbk and point each packed song at a blob URL holding its bytes. */
function openSbk(bytes: Uint8Array, bookUrl: string): Songbook {
  const { manifest, root, read } = unpackSongbook(bytes)
  const book = parseSongbook(manifest, bookUrl, `${ZIP_ORIGIN}/${root}`)

  const entryOf = (file: string) =>
    file.startsWith(`${ZIP_ORIGIN}/`) ? decodeURIComponent(new URL(file).pathname.slice(1)) : null
  const wanted = new Set(book.tabs.map((t) => entryOf(t.file)).filter((n) => n !== null))
  const files = read(wanted)

  const blobUrls: string[] = []
  for (const tab of book.tabs) {
    const entry = entryOf(tab.file)
    if (entry === null) continue
    const data = files[entry]
    if (!data) throw new Error(`"${tab.title}": ${entry} is not in the songbook file`)
    tab.file = URL.createObjectURL(new Blob([data as Uint8Array<ArrayBuffer>]))
    blobUrls.push(tab.file)
  }
  book.release = () => blobUrls.forEach((u) => URL.revokeObjectURL(u))
  return book
}

export async function fetchSongbook(url: string): Promise<Songbook> {
  let absolute: string
  try {
    absolute = absoluteBookUrl(url)
  } catch {
    throw new Error(`"${url}" is not a valid URL`)
  }

  if (isLocalBook(absolute)) {
    return openSbk(new Uint8Array(await readLocalSongbook(absolute)), absolute)
  }

  let response: Response
  try {
    response = await fetch(absolute)
  } catch {
    // fetch rejects with an opaque TypeError for CORS and network failures.
    throw new Error(`could not reach ${absolute} (offline, or the host does not allow CORS)`)
  }
  if (!response.ok) throw new Error(`${absolute}: ${response.status} ${response.statusText}`)

  // Sniff rather than trust the extension or Content-Type: hosts get both wrong.
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (isZip(bytes)) return openSbk(bytes, absolute)

  let json: unknown
  try {
    json = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    throw new Error(`${absolute} is neither a songbook JSON nor a .sbk file`)
  }
  return parseSongbook(json, absolute, absolute)
}
