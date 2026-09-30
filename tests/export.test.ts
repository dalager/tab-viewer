// exportSongbook's checks and naming, and the fetch helper it reads pieces with.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { exportSongbook } from '@/lib/exportSongbook'
import { unpackSongbook } from '@/lib/sbk'
import { IMPORTED_BOOK } from '@/lib/pieces'
import { errorMessage, fetchBytes, filterTabs } from '@/lib/utils'
import type { TabEntry } from '@/types'

afterEach(() => vi.unstubAllGlobals())

const piece = (title: string, file = `data:application/octet-stream;base64,${btoa('x')}`): TabEntry => ({
  book: IMPORTED_BOOK,
  id: 'x',
  title,
  artist: '',
  ext: 'gp5',
  file,
})

const request = (name: string, tabs: TabEntry[]) => ({ name, description: '', tabs, compress: false })

async function manifestOf(file: File) {
  return unpackSongbook(new Uint8Array(await file.arrayBuffer())).manifest as {
    name: string
    description?: string
    songs: { id: string; url: string; artist?: string }[]
  }
}

describe('exportSongbook', () => {
  it('needs a name', async () => {
    await expect(exportSongbook(request('   ', [piece('Air')]))).rejects.toThrow('give the songbook a name')
  })

  it('needs at least one piece', async () => {
    await expect(exportSongbook(request('Book', []))).rejects.toThrow('select at least one piece')
  })

  it('names a piece it could not read', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('gone')))
    await expect(exportSongbook(request('Book', [piece('Air', 'blob:revoked')]))).rejects.toThrow(
      '"Air" could not be read (gone)',
    )
  })

  it('numbers pieces and names the file for titles that slug to nothing', async () => {
    const file = await exportSongbook(request('¿¿', [piece('Air'), piece('¡¡')]))
    expect(file.name).toBe('songbook.sbk')
    const manifest = await manifestOf(file)
    expect(manifest.songs.map((s) => [s.id, s.url])).toEqual([
      ['air', 'tabs/air.gp5'],
      ['song-2', 'tabs/song-2.gp5'],
    ])
    // Blank artists and descriptions are left out rather than written empty.
    expect(manifest.songs[0].artist).toBeUndefined()
    expect(manifest.description).toBeUndefined()
  })
})

describe('fetchBytes', () => {
  it('turns an HTTP error into a message with its status', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response('nope', { status: 404, statusText: 'Not Found' })))
    await expect(fetchBytes('https://tabs.example/air.gp5')).rejects.toThrow('404 Not Found')
  })

  it('returns the body as bytes', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response(new Uint8Array([1, 2, 3]))))
    expect(Array.from(await fetchBytes('https://tabs.example/air.gp5'))).toEqual([1, 2, 3])
  })
})

describe('errorMessage', () => {
  it("is an Error's message, and anything else as text", () => {
    expect(errorMessage(new Error('boom'))).toBe('boom')
    expect(errorMessage('plain')).toBe('plain')
    expect(errorMessage(42)).toBe('42')
  })
})

describe('filterTabs', () => {
  const tabs = [piece('Air on G'), piece('Cello Prelude'), piece('Gigue')]

  it('keeps titles containing the query, ignoring case and outer spaces', () => {
    expect(filterTabs(tabs, '  cELLo ').map((t) => t.title)).toEqual(['Cello Prelude'])
    expect(filterTabs(tabs, 'g').map((t) => t.title)).toEqual(['Air on G', 'Gigue'])
  })

  it('keeps everything for a blank query', () => {
    expect(filterTabs(tabs, '   ')).toBe(tabs)
  })
})
