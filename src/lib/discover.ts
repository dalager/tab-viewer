/**
 * Finding the collection a web page points at. A page names its collection
 * the way a page names its feed:
 *
 *   <link rel="alternate" type="application/vnd.tabviewer.collection+json"
 *         href="songbooks/collection.json">
 *
 * so the page's own address can be handed out as the collection's.
 */

import { COLLECTION_TYPE } from '@/lib/collection'

const SELECTOR = `link[rel~="alternate" i][type="${COLLECTION_TYPE}" i][href]`

/** The link's target against the page, or null when it is not an http(s) URL. */
function target(link: Element, page: URL): URL | null {
  try {
    const url = new URL(link.getAttribute('href') as string, page)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

/** The first collection a page's HTML names, resolved against the page; null when it names none. */
export function discoverCollection(html: string, page: URL): URL | null {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  for (const link of doc.querySelectorAll(SELECTOR)) {
    const url = target(link, page)
    if (url) return url
  }
  return null
}
