// Permanent links: what /p/<id>?bar=&book= parses to, and that the links the
// app writes parse back to the same piece, bar and songbook.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addCollectionParam,
  parseLocation,
  piecePath,
  pieceUrl,
  withoutAddCollection,
} from '@/lib/permalink'

const ORIGIN = 'https://tabs.example'

beforeEach(() => vi.stubGlobal('window', { location: { origin: ORIGIN } }))
afterEach(() => vi.unstubAllGlobals())

/** Parse a site-relative path as if it were the address bar. */
function parse(pathAndQuery: string) {
  const url = new URL(pathAndQuery, ORIGIN)
  return parseLocation({ pathname: url.pathname, search: url.search } as Location)
}

describe('parseLocation', () => {
  it('reads the piece id, with or without a trailing slash', () => {
    expect(parse('/p/air-2')).toEqual({ id: 'air-2', bar: null, book: null })
    expect(parse('/p/air-2/').id).toBe('air-2')
  })

  it.each(['/', '/p/', '/p/Air', '/p/air/extra', '/x/air'])('finds no piece in %s', (path) => {
    expect(parse(path).id).toBeNull()
  })

  it('reads a positive whole bar number', () => {
    expect(parse('/p/air?bar=12').bar).toBe(12)
  })

  it.each(['0', '-3', '1.5', '12abc', ''])('ignores bar=%s', (bar) => {
    expect(parse(`/p/air?bar=${bar}`).bar).toBeNull()
  })

  it('resolves a site-relative book against this site', () => {
    expect(parse('/p/air?book=/songbooks/bach/songbook.json').book).toBe(
      `${ORIGIN}/songbooks/bach/songbook.json`,
    )
  })

  it('keeps a book on another site as it is', () => {
    expect(parse('/p/air?book=https://other.example/b.sbk').book).toBe('https://other.example/b.sbk')
  })

  it('treats a malformed book as no book', () => {
    expect(parse('/p/air?book=http://').book).toBeNull()
  })
})

describe('piecePath', () => {
  it('is the bare piece path without a bar or book', () => {
    expect(piecePath('air')).toBe('/p/air')
    expect(piecePath('air', null, null)).toBe('/p/air')
  })

  it('shortens a book on this site to a readable path', () => {
    expect(piecePath('air', 12, `${ORIGIN}/songbooks/bach/songbook.json`)).toBe(
      '/p/air?book=/songbooks/bach/songbook.json&bar=12',
    )
  })

  it('keeps a book on another site whole and readable', () => {
    expect(piecePath('air', null, 'https://other.example/b.sbk')).toBe(
      '/p/air?book=https://other.example/b.sbk',
    )
  })

  it.each([
    ['piece', 'air', null, null],
    ['bar', 'air', 7, null],
    ['book on this site', 'gigue', 3, `${ORIGIN}/songbooks/bach/songbook.json`],
    ['book with its own query', 'gigue', 3, 'https://other.example/b.json?v=1&x=a%20b'],
  ])('parses back to the same %s', (_, id, bar, book) => {
    expect(parse(piecePath(id, bar, book))).toEqual({ id, bar, book })
  })
})

describe('pieceUrl', () => {
  it('is the piece path on this site', () => {
    expect(pieceUrl('air', 4)).toBe(`${ORIGIN}/p/air?bar=4`)
  })
})

describe('addcollection links', () => {
  /** The parts of the address bar for a site-relative address. */
  function at(address: string) {
    const { pathname, search, hash } = new URL(address, ORIGIN)
    return { pathname, search, hash }
  }

  it('reads the collection a link asks to add, as written', () => {
    expect(addCollectionParam(at('/?addcollection=samplestore.meh/songbooks_easy'))).toBe(
      'samplestore.meh/songbooks_easy',
    )
    expect(addCollectionParam(at('/p/air?book=/b.sbk&addcollection=https%3A%2F%2Fa.example%2Fx%2F'))).toBe(
      'https://a.example/x/',
    )
  })

  it.each(['/', '/p/air?bar=2', '/?addcollection=', '/?addcollection=%20'])('finds none in %s', (address) => {
    expect(addCollectionParam(at(address))).toBeNull()
  })

  it('takes it out of the address and leaves the rest', () => {
    expect(withoutAddCollection(at('/?addcollection=samplestore.meh/easy'))).toBe('/')
    expect(withoutAddCollection(at('/p/air?bar=2&addcollection=a.example/x#top'))).toBe('/p/air?bar=2#top')
  })

  it('keeps a piece link pointing at the same book and bar', () => {
    const address = withoutAddCollection(at('/p/air?book=/songbooks/bach.sbk&bar=3&addcollection=a.example'))
    expect(parse(address)).toEqual({ id: 'air', bar: 3, book: `${ORIGIN}/songbooks/bach.sbk` })
  })
})
