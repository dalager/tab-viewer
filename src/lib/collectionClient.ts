/** Fetching collections, and what the picker shows for each one while it does. */

import { type Collection, collectionUrl, documentUrl, parseCollection } from '@/lib/collection'
import { discoverCollection } from '@/lib/discover'
import type { SavedCollection } from '@/lib/savedCollections'
import { errorMessage, looksLikeHtml } from '@/lib/utils'

/** How fetching a collection ended. */
export type CollectionResult =
  | { status: 'ready'; collection: Collection }
  | { status: 'error'; error: string }

/** A saved collection with where its fetch stands. */
export type CollectionListing = SavedCollection & (CollectionResult | { status: 'loading' })

function parseJson(text: string, document: URL): unknown {
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(
      looksLikeHtml(text)
        ? `${document} returned a web page, not a collection`
        : `${document} is not JSON`,
    )
  }
}

/** Fetches a document as text, with the messages a failure to do so gives. */
async function fetchText(document: URL): Promise<string> {
  let response: Response
  try {
    // A static host may send no cache headers; always ask whether it changed.
    response = await fetch(document.href, { cache: 'no-cache' })
  } catch {
    // fetch rejects with an opaque TypeError for CORS and network failures.
    throw new Error(`could not reach ${document} (offline, or the host does not allow CORS)`)
  }
  if (!response.ok) throw new Error(`${document}: ${response.status} ${response.statusText}`)
  return response.text()
}

/** Reads a collection document. */
async function readDocument(document: URL): Promise<Collection> {
  return parseCollection(parseJson(await fetchText(document), document), document)
}

/** Reads the collection a web page names, or the page itself if it is the document. */
async function readPage(page: URL): Promise<Collection> {
  const text = await fetchText(page)
  if (!looksLikeHtml(text)) return parseCollection(parseJson(text, page), page)
  const linked = discoverCollection(text, page)
  if (!linked) throw new Error(`${page} is a web page that names no collection`)
  return readDocument(linked)
}

/** The collection the page at a folder's address names, or null when there is none to be had. */
async function linkedFrom(folder: URL): Promise<URL | null> {
  try {
    return discoverCollection(await fetchText(folder), folder)
  } catch {
    return null
  }
}

/**
 * Reads collection.json in a folder. Failing that, the folder's address may be
 * a web page that names its collection; if it is not, the first failure stands.
 */
async function readFolder(folder: URL): Promise<Collection> {
  try {
    return await readDocument(documentUrl(folder))
  } catch (e) {
    const linked = await linkedFrom(folder)
    if (!linked) throw e
    return readDocument(linked)
  }
}

async function readCollection(url: URL): Promise<Collection> {
  if (url.pathname.endsWith('/')) return readFolder(url)
  return url.pathname.endsWith('.json') ? readDocument(url) : readPage(url)
}

/** Fetches and validates a collection. Never rejects: a failure is a result. */
export async function fetchCollection(url: URL): Promise<CollectionResult> {
  try {
    return { status: 'ready', collection: await readCollection(url) }
  } catch (e) {
    return { status: 'error', error: errorMessage(e) }
  }
}

/** What to save for a collection someone typed or linked, or why it cannot be added. */
export async function resolveCollection(
  input: string,
  origin: string,
): Promise<{ saved: SavedCollection } | { error: string }> {
  let url: URL
  try {
    url = collectionUrl(input, origin)
  } catch (e) {
    return { error: errorMessage(e) }
  }
  const result = await fetchCollection(url)
  if (result.status === 'error') return { error: result.error }
  return { saved: { url: url.href, name: result.collection.name } }
}

/** Each saved collection with its latest result; one not fetched yet is loading. */
export function listings(
  saved: SavedCollection[],
  results: Record<string, CollectionResult>,
): CollectionListing[] {
  return saved.map((entry) => ({ ...entry, ...(results[entry.url] ?? { status: 'loading' }) }))
}
