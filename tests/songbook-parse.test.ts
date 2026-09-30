// parseSongbook: what a manifest must hold, and what fills in for what it
// leaves out.

import { describe, expect, it } from 'vitest'
import { parseSongbook } from '@/lib/songbook'

const BOOK_URL = new URL('https://tabs.example/books/bach/songbook.json')
const parse = (json: unknown, url = BOOK_URL) => parseSongbook(json, url)
const firstSong = (song: unknown) => parse({ songs: [song] }).tabs[0]

describe('parseSongbook refuses', () => {
  it.each([null, [], 'songs', 3])('a manifest that is not an object: %j', (json) => {
    expect(() => parse(json)).toThrow('not a songbook: expected a JSON object')
  })

  it('a manifest without a songs list', () => {
    expect(() => parse({ name: 'Empty' })).toThrow(/missing a "songs" list/)
  })

  it('a song that is not an object, naming it', () => {
    expect(() => parse({ songs: [{ url: 'a.gp5' }, 'b.gp5'] })).toThrow('song 2: expected an object')
  })

  it.each([{}, { url: '' }, { url: '   ' }, { url: 7 }])('a song without a url: %j', (song) => {
    expect(() => parse({ songs: [song] })).toThrow('song 1: missing "url"')
  })

  it('a url that does not parse', () => {
    expect(() => parse({ songs: [{ url: 'https://[nope' }] })).toThrow(
      'song 1: invalid url "https://[nope"',
    )
  })

  it.each(['file:///etc/passwd', 'data:text/plain,hi', 'javascript:alert(1)'])(
    'a url that is not http(s): %s',
    (url) => {
      expect(() => parse({ songs: [{ url }] })).toThrow('song 1: only http(s) urls are supported')
    },
  )
})

describe('parseSongbook fills in', () => {
  it('the id and title from the file name', () => {
    const song = firstSong({ url: 'tabs/Cello%20Suite.gp5' })
    expect(song).toMatchObject({ id: 'cello-suite', title: 'Cello Suite', artist: '', ext: 'gp5' })
  })

  it('a numbered id and title when the file name gives nothing to go on', () => {
    // A URL ending in "/" has no file name to take them from.
    const song = parse({ songs: [{ url: 'a.gp5' }, { url: 'tabs/' }] }).tabs[1]
    expect(song).toMatchObject({ id: 'song-2', title: 'Song 2' })
  })

  it('a numbered id when the given one slugs to nothing', () => {
    expect(firstSong({ url: 'air.gp5', id: '¿¿' }).id).toBe('song-1')
  })

  it('trimmed values over the fallbacks', () => {
    const song = firstSong({ url: 'x.GP4', id: ' Air ', title: ' Air on G ', artist: ' Bach ' })
    expect(song).toMatchObject({ id: 'air', title: 'Air on G', artist: 'Bach', ext: 'gp4' })
  })

  it("the book's name from its host, and a stock name without one", () => {
    expect(parse({ songs: [] }).name).toBe('tabs.example')
    expect(parse({ name: '  ', songs: [] }).name).toBe('tabs.example')
    const noHost = parseSongbook({ songs: [] }, new URL('local:abc'), BOOK_URL)
    expect(noHost.name).toBe('Untitled songbook')
  })

  it('no description rather than a blank one', () => {
    expect(parse({ description: ' ', songs: [] }).description).toBeUndefined()
    expect(parse({ description: ' Preludes ', songs: [] }).description).toBe('Preludes')
  })
})
