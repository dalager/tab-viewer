// fetchSongbook: loading a book by URL as JSON or .sbk, and the messages it
// gives when the URL, the network or the file is wrong.

import { type Blob, resolveObjectURL } from 'node:buffer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { packSongbook } from '@/lib/sbk'
import { fetchSongbook } from '@/lib/songbook'

const ORIGIN = 'https://tabs.example'
const BOOK = `${ORIGIN}/songbooks/bach/songbook.json`
const SBK = `${ORIGIN}/songbooks/bach.sbk`

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  vi.stubGlobal('window', { location: { origin: ORIGIN } })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

/** The host answers with these bytes, or this JSON serialised. */
function serve(body: Uint8Array | object, init?: ResponseInit) {
  const bytes = body instanceof Uint8Array ? body : new TextEncoder().encode(JSON.stringify(body))
  fetchMock.mockResolvedValue(new Response(bytes as Uint8Array<ArrayBuffer>, init))
}

describe('fetchSongbook', () => {
  it('refuses a URL it cannot parse, without fetching', async () => {
    await expect(fetchSongbook('http://')).rejects.toThrow('"http://" is not a valid URL')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('explains a network or CORS failure', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(fetchSongbook(BOOK)).rejects.toThrow(
      `could not reach ${BOOK} (offline, or the host does not allow CORS)`,
    )
  })

  it('reports an HTTP error with its status', async () => {
    serve(new Uint8Array(), { status: 404, statusText: 'Not Found' })
    await expect(fetchSongbook(BOOK)).rejects.toThrow(`${BOOK}: 404 Not Found`)
  })

  it('refuses a file that is neither JSON nor a zip', async () => {
    serve(new TextEncoder().encode('<html>not here</html>'))
    await expect(fetchSongbook(BOOK)).rejects.toThrow(
      `${BOOK} is neither a songbook JSON nor a .sbk file`,
    )
  })

  it('passes on what the manifest parser refuses', async () => {
    serve({ songbook: 1 })
    await expect(fetchSongbook(BOOK)).rejects.toThrow('missing a "songs" list')
  })

  it('loads a site-relative JSON book, resolving songs against the manifest', async () => {
    serve({ name: 'Bach', songs: [{ url: 'tabs/air.gp5', title: 'Air' }] })
    const book = await fetchSongbook('/songbooks/bach/songbook.json')
    expect(fetchMock).toHaveBeenCalledWith(BOOK)
    expect(book.url).toBe(BOOK)
    expect(book.tabs.map((t) => t.file)).toEqual([`${ORIGIN}/songbooks/bach/tabs/air.gp5`])
  })

  it('recognises a .sbk by its bytes, whatever the URL says', async () => {
    serve(packSongbook({ songs: [{ url: 'tabs/air.gp5' }] }, { 'tabs/air.gp5': new Uint8Array([1]) }))
    const book = await fetchSongbook(BOOK)
    expect(book.tabs[0].file).toMatch(/^blob:/)
    book.release()
  })

  it('serves packed songs from blob URLs holding their bytes, and frees them on release', async () => {
    const air = new Uint8Array([1, 2, 3])
    serve(
      packSongbook(
        {
          songs: [
            { url: 'tabs/air.gp5', title: 'Air' },
            { url: 'https://other.example/gigue.gp5', title: 'Gigue' },
          ],
        },
        { 'tabs/air.gp5': air },
      ),
    )
    const book = await fetchSongbook(SBK)
    const [packed, linked] = book.tabs

    expect(new Uint8Array(await blobAt(packed.file).arrayBuffer())).toEqual(air)
    expect(linked.file).toBe('https://other.example/gigue.gp5')

    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    book.release()
    expect(revoke).toHaveBeenCalledExactlyOnceWith(packed.file)
    revoke.mockRestore()
  })

  it('names a packed song whose file is missing from the .sbk', async () => {
    serve(packSongbook({ songs: [{ url: 'tabs/air.gp5', title: 'Air' }] }, {}))
    await expect(fetchSongbook(SBK)).rejects.toThrow(
      '"Air": tabs/air.gp5 is not in the songbook file',
    )
  })
})

/** The blob a blob URL made by the book points at. */
function blobAt(url: string): Blob {
  const blob = resolveObjectURL(url)
  if (!blob) throw new Error(`${url} does not resolve`)
  return blob
}
