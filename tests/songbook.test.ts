// Holds the bundled songbooks and the exporter to the published schema, and
// checks that the app refuses manifest formats it does not know.

import fs from 'node:fs'
import path from 'node:path'
import { Ajv2020 } from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { describe, expect, it } from 'vitest'
import { exportSongbook } from '@/lib/exportSongbook'
import { unpackSongbook } from '@/lib/sbk'
import { IMPORTED_BOOK } from '@/lib/pieces'
import { parseSongbook, SONGBOOK_SCHEMA } from '@/lib/songbook'
import schema from '../public/schema/songbook-1.schema.json'

const ajv = new Ajv2020({ allErrors: true })
addFormats(ajv)
const validate = ajv.compile(schema)

/** Schema errors as readable lines, [] when the manifest is valid. */
function schemaErrors(manifest: unknown): string[] {
  if (validate(manifest)) return []
  return (validate.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message}`)
}

/** Ids repeated within a book; the schema cannot express uniqueness. */
function duplicateIds(manifest: { songs: { id?: string }[] }): string[] {
  const ids = manifest.songs.map((s) => s.id).filter((id) => id !== undefined)
  return ids.filter((id, i) => ids.indexOf(id) !== i)
}

const BOOK_URL = new URL('https://example.com/book/songbook.json')

describe('songbook schema', () => {
  it('publishes its own URL as its $id', () => {
    expect(schema.$id).toBe(SONGBOOK_SCHEMA)
  })

  const dir = path.resolve(import.meta.dirname, '../songbooks')
  const books = fs.readdirSync(dir).filter((f) => f.endsWith('.sbk'))

  it.each(books)('accepts the bundled %s', (book) => {
    const { manifest } = unpackSongbook(new Uint8Array(fs.readFileSync(path.join(dir, book))))
    expect(schemaErrors(manifest)).toEqual([])
    expect(duplicateIds(manifest as { songs: { id?: string }[] })).toEqual([])
  })

  it('accepts what the exporter writes', async () => {
    const piece = (title: string) => ({
      book: IMPORTED_BOOK,
      id: 'x',
      title,
      artist: '',
      ext: 'gp5',
      file: `data:application/octet-stream;base64,${btoa(title)}`,
    })
    const file = await exportSongbook({
      name: 'Test book',
      description: 'For the tests',
      tabs: [piece('Air'), piece('Air'), piece('Nº 2 Gigue')],
      compress: true,
    })
    const { manifest } = unpackSongbook(new Uint8Array(await file.arrayBuffer()))
    expect(schemaErrors(manifest)).toEqual([])
    expect(duplicateIds(manifest as { songs: { id?: string }[] })).toEqual([])
    expect(parseSongbook(manifest, BOOK_URL).tabs.map((t) => t.id)).toEqual([
      'air',
      'air-2',
      'no-2-gigue',
    ])
  })
})

describe('parseSongbook format version', () => {
  const songs = [{ url: 'tabs/air.gp5' }]

  it('reads format 1, and a manifest without a version as format 1', () => {
    expect(parseSongbook({ songbook: 1, songs }, BOOK_URL).tabs).toHaveLength(1)
    expect(parseSongbook({ songs }, BOOK_URL).tabs).toHaveLength(1)
  })

  it('records the book on every entry, since ids are only unique within it', () => {
    expect(parseSongbook({ songs }, BOOK_URL).tabs[0].book).toBe(BOOK_URL.href)
  })

  it('refuses a newer format', () => {
    expect(() => parseSongbook({ songbook: 2, songs }, BOOK_URL)).toThrow(/newer/)
  })

  it.each([0, '1', null, 1.5])('refuses format %j', (songbook) => {
    expect(() => parseSongbook({ songbook, songs }, BOOK_URL)).toThrow(/unknown format/)
  })
})
