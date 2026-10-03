// Fetching a collection: the request it makes, the messages it gives when the
// host, the network or the document is wrong, and what adding one saves.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchCollection, listings, resolveCollection } from '@/lib/collectionClient'

const ORIGIN = 'https://tabs.example'
const FOLDER = new URL('https://store.example/easy/')
const DOC = 'https://store.example/easy/collection.json'
const EASY = { collection: 1, name: 'Easy pieces', books: [{ url: 'week-1.sbk', name: 'Week 1' }] }

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => vi.stubGlobal('fetch', fetchMock))
afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

/** The host answers with this text, or this JSON serialised. */
function serve(body: string | object, init?: ResponseInit) {
  const text = typeof body === 'string' ? body : JSON.stringify(body)
  fetchMock.mockResolvedValue(new Response(text, init))
}

/** The message a collection that cannot be read gives. */
async function errorOf(url: URL = FOLDER): Promise<string | undefined> {
  const result = await fetchCollection(url)
  return result.status === 'error' ? result.error : undefined
}

describe('fetchCollection', () => {
  it('reads collection.json in the folder, asking the host whether it changed', async () => {
    serve(EASY)
    const result = await fetchCollection(FOLDER)
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(DOC, { cache: 'no-cache' })
    expect(result).toEqual({
      status: 'ready',
      collection: {
        name: 'Easy pieces',
        books: [{ url: 'https://store.example/easy/week-1.sbk', name: 'Week 1' }],
      },
    })
  })

  it('reads a document named outright as it is', async () => {
    serve(EASY)
    await fetchCollection(new URL('https://store.example/api/books.json'))
    expect(fetchMock).toHaveBeenCalledWith('https://store.example/api/books.json', { cache: 'no-cache' })
  })

  it('explains a network or CORS failure', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    expect(await errorOf()).toBe(`could not reach ${DOC} (offline, or the host does not allow CORS)`)
  })

  it('reports an HTTP error with its status', async () => {
    serve('', { status: 404, statusText: 'Not Found' })
    expect(await errorOf()).toBe(`${DOC}: 404 Not Found`)
  })

  it('recognises a web page sent in place of the document', async () => {
    serve('\n<!doctype html><html><body>Sign in</body></html>')
    expect(await errorOf()).toBe(`${DOC} returned a web page, not a collection`)
  })

  it('refuses anything else that is not JSON', async () => {
    serve('PK not json')
    expect(await errorOf()).toBe(`${DOC} is not JSON`)
  })

  it('passes on what the parser refuses', async () => {
    serve({ collection: 1, name: 'Easy' })
    expect(await errorOf()).toBe('not a collection: missing a "books" list')
  })
})

describe('fetchCollection, given a page rather than a document', () => {
  const PAGE = new URL('https://store.example/lessons.html')

  /** Each address answers with its own response, anything else with 404. */
  function serveEach(answers: Record<string, () => Response>) {
    fetchMock.mockImplementation(async (input) => {
      const answer = answers[String(input)]
      return answer ? answer() : new Response('', { status: 404, statusText: 'Not Found' })
    })
  }

  it('looks at the folder address itself when it holds no collection.json', async () => {
    serveEach({})
    // Neither is there, so what is reported is the document that was asked for first.
    expect(await errorOf()).toBe(`${DOC}: 404 Not Found`)
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([DOC, FOLDER.href])
  })

  it('keeps the first failure when the folder address cannot be reached either', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    expect(await errorOf()).toBe(`could not reach ${DOC} (offline, or the host does not allow CORS)`)
  })

  it('reads a file that is not .json as the document when it holds one', async () => {
    serveEach({ [PAGE.href]: () => new Response(JSON.stringify(EASY)) })
    const result = await fetchCollection(PAGE)
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(PAGE.href, { cache: 'no-cache' })
    expect(result).toMatchObject({
      status: 'ready',
      collection: { books: [{ url: 'https://store.example/week-1.sbk' }] },
    })
  })

  it('reports a page that cannot be fetched', async () => {
    serveEach({})
    expect(await errorOf(PAGE)).toBe(`${PAGE}: 404 Not Found`)
  })

  it('refuses a file that is neither a page nor JSON', async () => {
    serveEach({ [PAGE.href]: () => new Response('PK not json') })
    expect(await errorOf(PAGE)).toBe(`${PAGE} is not JSON`)
  })
})

describe('resolveCollection', () => {
  it('saves the normalised address with the name the collection gives', async () => {
    serve(EASY)
    expect(await resolveCollection('store.example/easy', ORIGIN)).toEqual({
      saved: { url: FOLDER.href, name: 'Easy pieces' },
    })
  })

  it('refuses an address it cannot use, without fetching', async () => {
    expect(await resolveCollection('ftp://store.example/easy', ORIGIN)).toEqual({
      error: 'only http(s) collections are supported',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('saves nothing for a collection that cannot be read', async () => {
    serve('', { status: 403, statusText: 'Forbidden' })
    expect(await resolveCollection(FOLDER.href, ORIGIN)).toEqual({ error: `${DOC}: 403 Forbidden` })
  })
})

describe('listings', () => {
  const saved = [
    { url: 'https://a.example/', name: 'A' },
    { url: 'https://b.example/', name: 'B' },
  ]

  it('shows a collection as loading until its result arrives', () => {
    const shown = listings(saved, { 'https://b.example/': { status: 'error', error: 'gone' } })
    expect(shown).toEqual([
      { url: 'https://a.example/', name: 'A', status: 'loading' },
      { url: 'https://b.example/', name: 'B', status: 'error', error: 'gone' },
    ])
  })

  it('leaves out results for collections no longer saved', () => {
    expect(listings([], { 'https://a.example/': { status: 'error', error: 'gone' } })).toEqual([])
  })
})
