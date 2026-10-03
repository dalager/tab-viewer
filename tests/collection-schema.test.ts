// Holds the collection schema, the parser and the make-collection script to
// one another: what the script writes must validate and must read back.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Ajv2020 } from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { afterAll, describe, expect, it } from 'vitest'
import { COLLECTION_SCHEMA, parseCollection } from '@/lib/collection'
import schema from '../public/schema/collection-1.schema.json'

const ajv = new Ajv2020({ allErrors: true })
addFormats(ajv)
const validate = ajv.compile(schema)

/** Schema errors as readable lines, [] when the document is valid. */
function schemaErrors(document: unknown): string[] {
  if (validate(document)) return []
  return (validate.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message}`)
}

const [example] = schema.examples
const ROOT = path.resolve(import.meta.dirname, '..')
const SCRIPT = path.join(ROOT, 'scripts/make-collection.mjs')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'collection-'))
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }))

describe('collection schema', () => {
  it('publishes its own URL as its $id', () => {
    expect(schema.$id).toBe(COLLECTION_SCHEMA)
  })

  it('accepts its own example, which the app reads', () => {
    expect(schemaErrors(example)).toEqual([])
    const { books } = parseCollection(example, new URL('https://store.example/easy/collection.json'))
    expect(books[0].url).toBe('https://store.example/easy/week-1.sbk')
  })

  it('accepts x- extensions and rejects other unknown keys', () => {
    const [book] = example.books
    expect(schemaErrors({ ...example, 'x-term': 'autumn', books: [{ ...book, 'x-level': 2 }] })).toEqual([])
    expect(schemaErrors({ ...example, term: 'autumn' })).not.toEqual([])
    expect(schemaErrors({ ...example, books: [{ ...book, level: 2 }] })).not.toEqual([])
  })

  it.each(['collection', 'name', 'books'] as const)('requires "%s"', (key) => {
    const { [key]: _, ...rest } = example
    expect(schemaErrors(rest)).not.toEqual([])
  })

  it.each(['local:1234', 'javascript:alert(1)'])('rejects a book at %s', (url) => {
    expect(schemaErrors({ ...example, books: [{ url, name: 'X' }] })).not.toEqual([])
  })
})

describe('make-collection', () => {
  const run = (...args: string[]) =>
    execFileSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', stdio: 'pipe' })
  const written = (dir: string) =>
    JSON.parse(fs.readFileSync(path.join(dir, 'collection.json'), 'utf8')) as unknown

  it('lists the .sbk files of a folder in a document the schema and the app accept', () => {
    const dir = path.join(tmp, 'easy pieces')
    fs.mkdirSync(dir)
    const sbk = path.join(ROOT, 'songbooks/bach-for-guitar.sbk')
    fs.copyFileSync(sbk, path.join(dir, 'week 2.sbk'))
    fs.copyFileSync(sbk, path.join(dir, 'week 10.sbk'))
    fs.writeFileSync(path.join(dir, 'notes.txt'), 'not a book')

    run(dir, '--description', 'One a week')
    const document = written(dir)
    expect(schemaErrors(document)).toEqual([])

    const collection = parseCollection(document, new URL('https://store.example/easy/collection.json'))
    expect(collection.name).toBe('easy pieces')
    expect(collection.description).toBe('One a week')
    // In the order a person would number them, and with names from the books themselves.
    expect(collection.books.map((b) => b.url)).toEqual([
      'https://store.example/easy/week%202.sbk',
      'https://store.example/easy/week%2010.sbk',
    ])
    expect(collection.books[0]).toMatchObject({
      name: 'Starter pieces',
      songs: 4,
      size: fs.statSync(sbk).size,
    })
  })

  it('takes the collection name from --name', () => {
    const dir = path.join(tmp, 'named')
    fs.mkdirSync(dir)
    fs.copyFileSync(path.join(ROOT, 'songbooks/bach-for-guitar.sbk'), path.join(dir, 'a.sbk'))
    run(dir, '--name', 'Autumn term')
    expect(written(dir)).toMatchObject({ name: 'Autumn term' })
  })

  it('names a file that is not a songbook, and writes nothing', () => {
    const dir = path.join(tmp, 'broken')
    fs.mkdirSync(dir)
    fs.writeFileSync(path.join(dir, 'bad.sbk'), 'not a zip')
    expect(() => run(dir)).toThrow(/bad\.sbk is not a readable zip/)
    expect(fs.existsSync(path.join(dir, 'collection.json'))).toBe(false)
  })

  it('refuses a folder with no songbooks, and a missing folder', () => {
    const dir = path.join(tmp, 'empty')
    fs.mkdirSync(dir)
    expect(() => run(dir)).toThrow(/no \.sbk files/)
    expect(() => run(path.join(tmp, 'nowhere'))).toThrow(/is not a folder/)
    expect(() => run()).toThrow(/usage:/)
  })
})
