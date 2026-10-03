/** Fetching collections, and what the picker shows for each one while it does. */

import { type Collection, collectionUrl, documentUrl, parseCollection } from '@/lib/collection'
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

async function readCollection(url: URL): Promise<Collection> {
  const document = documentUrl(url)
  let response: Response
  try {
    // A static host may send no cache headers; always ask whether it changed.
    response = await fetch(document.href, { cache: 'no-cache' })
  } catch {
    // fetch rejects with an opaque TypeError for CORS and network failures.
    throw new Error(`could not reach ${document} (offline, or the host does not allow CORS)`)
  }
  if (!response.ok) throw new Error(`${document}: ${response.status} ${response.statusText}`)
  return parseCollection(parseJson(await response.text(), document), document)
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
