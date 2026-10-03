// parseCollection: what a collection document parses to and what it refuses,
// and how an address someone typed or followed becomes the document to fetch.

import { describe, expect, it } from 'vitest'
import { collectionUrl, documentUrl, parseCollection } from '@/lib/collection'

const DOC = new URL('https://store.example/easy/collection.json')
const ORIGIN = 'https://tabs.example'

const parse = (json: unknown) => parseCollection(json, DOC)
const withBooks = (...books: unknown[]) => ({ collection: 1, name: 'Easy', books })

describe('parseCollection', () => {
  it('resolves relative book URLs against the document, and keeps absolute ones', () => {
    const { books } = parse(
      withBooks(
        { url: 'week-1.sbk', name: 'Week 1' },
        { url: '../shared/bach.sbk', name: 'Bach' },
        { url: 'https://other.example/book/songbook.json', name: 'Elsewhere' },
      ),
    )
    expect(books.map((b) => b.url)).toEqual([
      'https://store.example/easy/week-1.sbk',
      'https://store.example/shared/bach.sbk',
      'https://other.example/book/songbook.json',
    ])
  })

  it('reads the name and description, trimmed', () => {
    const collection = parse({ collection: 1, name: ' Easy ', description: ' Term one ', books: [] })
    expect(collection).toEqual({ name: 'Easy', description: 'Term one', books: [] })
  })

  it('names a collection without a name after its host', () => {
    expect(parse({ collection: 1, books: [] }).name).toBe('store.example')
  })

  it('names a book without a name after its file, or its position', () => {
    const { books } = parse(withBooks({ url: 'week%201.sbk' }, { url: 'https://other.example/' }))
    expect(books.map((b) => b.name)).toEqual(['week 1', 'Book 2'])
  })

  it('keeps the piece count, size and date a book gives', () => {
    const [book] = parse(
      withBooks({ url: 'a.sbk', name: 'A', description: 'First', songs: 4, size: 5252, updated: '2026-09-30T19:04:00Z' }),
    ).books
    expect(book).toEqual({
      url: 'https://store.example/easy/a.sbk',
      name: 'A',
      description: 'First',
      songs: 4,
      size: 5252,
      updated: '2026-09-30T19:04:00Z',
    })
  })

  it.each([-1, 1.5, '4', null])('drops a piece count of %j', (songs) => {
    expect(parse(withBooks({ url: 'a.sbk', songs })).books[0].songs).toBeUndefined()
  })

  it('ignores keys it does not know', () => {
    const json = { ...withBooks({ url: 'a.sbk', name: 'A', 'x-level': 2 }), 'x-term': 'autumn' }
    expect(parse(json).books).toHaveLength(1)
  })

  it.each([null, [], 'text', 7])('refuses %j, which is not an object', (json) => {
    expect(() => parse(json)).toThrow('expected a JSON object')
  })

  it('refuses a document without a version', () => {
    expect(() => parse({ name: 'Easy', books: [] })).toThrow('it has no "collection" version')
  })

  it('refuses a newer format', () => {
    expect(() => parse({ collection: 2, books: [] })).toThrow(/newer than this app understands/)
  })

  it.each([0, '1', null, 1.5])('refuses format %j', (collection) => {
    expect(() => parse({ collection, books: [] })).toThrow(/unknown format/)
  })

  it('says so when it is handed a songbook', () => {
    expect(() => parse({ songbook: 1, name: 'Bach', songs: [] })).toThrow(
      'this is a songbook, not a collection',
    )
  })

  it('refuses a document without a list of books', () => {
    expect(() => parse({ collection: 1, name: 'Easy' })).toThrow('missing a "books" list')
  })

  it('names the book that is wrong', () => {
    const fine = { url: 'a.sbk', name: 'A' }
    expect(() => parse(withBooks(fine, 'b.sbk'))).toThrow('book 2: expected an object')
    expect(() => parse(withBooks(fine, { name: 'B' }))).toThrow('book 2: missing "url"')
    expect(() => parse(withBooks(fine, { url: 'http://' }))).toThrow('book 2: invalid url "http://"')
  })

  it.each(['local:1234', 'javascript:alert(1)', 'file:///etc/passwd'])(
    'refuses a book at %s',
    (url) => {
      expect(() => parse(withBooks({ url }))).toThrow('book 1: only http(s) urls are supported')
    },
  )
})

describe('collectionUrl', () => {
  const href = (input: string) => collectionUrl(input, ORIGIN).href

  it('takes a bare host and folder to mean https', () => {
    expect(href('samplestore.meh/songbooks_easy')).toBe('https://samplestore.meh/songbooks_easy/')
    expect(href('localhost:8080/books')).toBe('https://localhost:8080/books/')
  })

  it('treats a folder with and without its trailing slash as one collection', () => {
    expect(href('https://samplestore.meh/songbooks_easy')).toBe(href('https://samplestore.meh/songbooks_easy/'))
  })

  it('keeps the scheme it is given, and a document named outright', () => {
    expect(href(' http://store.example/api/books.json ')).toBe('http://store.example/api/books.json')
  })

  it('leaves a file alone: only a last segment without an extension is a folder', () => {
    expect(href('store.example/lessons.html')).toBe('https://store.example/lessons.html')
    expect(href('store.example')).toBe('https://store.example/')
  })

  it('resolves a leading slash against this site', () => {
    expect(href('/songbooks')).toBe(`${ORIGIN}/songbooks/`)
  })

  it('drops a fragment', () => {
    expect(href('https://store.example/easy/#top')).toBe('https://store.example/easy/')
  })

  it('refuses a blank address', () => {
    expect(() => collectionUrl('  ', ORIGIN)).toThrow('enter the address of a collection')
  })

  it.each(['javascript:alert(1)', 'https://'])('refuses %s, which is not a URL', (input) => {
    expect(() => collectionUrl(input, ORIGIN)).toThrow(`"${input}" is not a valid URL`)
  })

  it('refuses a scheme other than http(s)', () => {
    expect(() => collectionUrl('ftp://store.example/easy', ORIGIN)).toThrow(
      'only http(s) collections are supported',
    )
  })
})

describe('documentUrl', () => {
  it('reads collection.json in a folder', () => {
    expect(documentUrl(new URL('https://store.example/easy/')).href).toBe(DOC.href)
  })

  it('reads a .json document as it is', () => {
    const named = new URL('https://store.example/api/books.json')
    expect(documentUrl(named).href).toBe(named.href)
  })
})
