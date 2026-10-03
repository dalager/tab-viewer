/**
 * Collections: a JSON document, hosted at any URL, listing songbooks.
 *
 *   { "collection": 1, "name": "…", "books": [{ "url": "week-1.sbk", "name": "Week 1" }] }
 *
 * Book URLs resolve against the document's own URL, so a folder holding
 * collection.json and its .sbk files is a complete collection. Whoever hosts
 * it distributes changes by editing it: the app reads it afresh each time.
 * The format is specified by public/schema/collection-1.schema.json.
 */

import { fileStem, isRecord, optionalString } from '@/lib/songbook'

/** The format this app reads, the document's `collection` field. */
export const COLLECTION_VERSION = 1

/** Where the schema for that format is published. */
export const COLLECTION_SCHEMA = 'https://tabviewer.dalagerlabs.com/schema/collection-1.schema.json'

/** The document a collection given as a folder is read from. */
export const COLLECTION_FILE = 'collection.json'

export interface CollectionBook {
  /** Absolute songbook or .sbk URL: the same identity the book has once loaded. */
  url: string
  name: string
  description?: string
  /** How many pieces the book holds, when the collection says. */
  songs?: number
  /** Size of the book file in bytes, when the collection says. */
  size?: number
  /** When the book last changed, as the collection wrote it. */
  updated?: string
}

export interface Collection {
  name: string
  description?: string
  books: CollectionBook[]
}

function isNewer(version: unknown): boolean {
  return Number.isInteger(version) && (version as number) > COLLECTION_VERSION
}

/** Why a `collection` value other than this app's is refused. */
function unknownVersion(version: unknown): string {
  if (version === undefined) return 'not a collection: it has no "collection" version'
  return isNewer(version)
    ? `collection format ${version} is newer than this app understands (format ${COLLECTION_VERSION}); update the app`
    : `not a collection: unknown format ${JSON.stringify(version)}`
}

/** Throws unless the document is in the one format this app reads. */
function checkVersion(json: Record<string, unknown>): void {
  if (json.collection === COLLECTION_VERSION) return
  if (Array.isArray(json.songs)) {
    throw new Error('this is a songbook, not a collection: load it with the songbook URL field')
  }
  throw new Error(unknownVersion(json.collection))
}

/** What parsing one book needs to know about the collection it is in. */
interface BookContext {
  /** 0-based position in the collection's list; errors name it 1-based. */
  index: number
  /** Base for relative book URLs. */
  resolveFrom: URL
}

/** A book's `url`, resolved and checked to be http(s). */
function bookUrl(book: Record<string, unknown>, { index, resolveFrom }: BookContext): URL {
  const where = `book ${index + 1}`
  const rawUrl = optionalString(book.url)
  if (!rawUrl) throw new Error(`${where}: missing "url"`)

  let url: URL
  try {
    url = new URL(rawUrl, resolveFrom)
  } catch {
    throw new Error(`${where}: invalid url "${rawUrl}"`)
  }
  if (!isHttp(url)) throw new Error(`${where}: only http(s) urls are supported`)
  return url
}

function isHttp(url: URL): boolean {
  return url.protocol === 'http:' || url.protocol === 'https:'
}

/** A count or size as the collection gave it, dropped unless it is a whole number from 0 up. */
function wholeNumber(value: unknown): number | undefined {
  return Number.isInteger(value) && (value as number) >= 0 ? (value as number) : undefined
}

/** What to call a book that gives no name: its file, or else its position. */
function fallbackName(url: URL, n: number): string {
  return fileStem(url) || `Book ${n}`
}

function parseBook(book: unknown, context: BookContext): CollectionBook {
  const n = context.index + 1
  if (!isRecord(book)) throw new Error(`book ${n}: expected an object`)
  const url = bookUrl(book, context)

  return {
    url: url.href,
    name: optionalString(book.name) ?? fallbackName(url, n),
    description: optionalString(book.description),
    songs: wholeNumber(book.songs),
    size: wholeNumber(book.size),
    updated: optionalString(book.updated),
  }
}

/** Validate a parsed collection document. Book URLs resolve against `documentUrl`. */
export function parseCollection(json: unknown, documentUrl: URL): Collection {
  if (!isRecord(json)) throw new Error('not a collection: expected a JSON object')
  checkVersion(json)
  if (!Array.isArray(json.books)) throw new Error('not a collection: missing a "books" list')

  return {
    name: optionalString(json.name) ?? documentUrl.hostname,
    description: optionalString(json.description),
    books: json.books.map((book, index) => parseBook(book, { index, resolveFrom: documentUrl })),
  }
}

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i

/** What was typed, with https:// in front unless it names a scheme or a path on this site. */
function withScheme(text: string): string {
  return text.startsWith('/') || HAS_SCHEME.test(text) ? text : `https://${text}`
}

/**
 * The address of a collection as typed or linked, made absolute. A bare
 * "host/folder" means https, and a leading "/" means this site. Anything not
 * ending in .json is a folder and gets its trailing slash, so both spellings
 * of a folder are one collection.
 */
export function collectionUrl(input: string, origin: string): URL {
  const text = input.trim()
  if (!text) throw new Error('enter the address of a collection')

  const url = absolute(text, origin)
  if (!isHttp(url)) throw new Error('only http(s) collections are supported')
  url.hash = ''
  if (lacksSlash(url.pathname)) url.pathname += '/'
  return url
}

function absolute(text: string, origin: string): URL {
  try {
    return new URL(withScheme(text), origin)
  } catch {
    throw new Error(`"${text}" is not a valid URL`)
  }
}

/** Whether a path names a folder without its trailing slash. */
function lacksSlash(pathname: string): boolean {
  return !pathname.endsWith('.json') && !pathname.endsWith('/')
}

/** The document to fetch for a collection: itself, or collection.json in its folder. */
export function documentUrl(collection: URL): URL {
  return collection.pathname.endsWith('/') ? new URL(COLLECTION_FILE, collection) : collection
}
