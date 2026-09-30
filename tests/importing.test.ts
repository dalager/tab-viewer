// Importing Guitar Pro files: which files are taken, what is stored for them,
// and reading their title and artist.

import fs from 'node:fs'
import path from 'node:path'
import { unzipSync } from 'fflate'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  IMPORTED_ID_PREFIX,
  importedRecord,
  importExtension,
  listImported,
  newImportId,
} from '@/lib/importedTabs'
import { readScoreMetadata } from '@/score/metadata'
import { buildSettings } from '@/score/settings'

afterEach(() => vi.unstubAllGlobals())

/** A real Guitar Pro 5 file from the bundled book. */
function bundled(name: string): ArrayBuffer {
  const sbk = path.resolve(import.meta.dirname, '../songbooks/bach-for-guitar.sbk')
  const bytes = unzipSync(new Uint8Array(fs.readFileSync(sbk)))[`tabs/${name}`]
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

describe('importExtension', () => {
  it('takes every Guitar Pro format, whatever the case', () => {
    for (const name of ['a.gp3', 'a.gp4', 'a.GP5', 'a.gpx', 'song.v2.gp']) {
      expect(importExtension(name)).toBe(name.split('.').pop()?.toLowerCase())
    }
  })

  it('refuses anything else, naming the file', () => {
    expect(() => importExtension('notes.txt')).toThrow(/^notes\.txt: not a Guitar Pro file \(\.gp3,/)
    expect(() => importExtension('README')).toThrow(/README: not a Guitar Pro file/)
  })
})

describe('importedRecord', () => {
  const file = { name: 'My Lick.v2.gp5', ext: 'gp5', bytes: new ArrayBuffer(4) }

  it("keeps the file's own title and artist", () => {
    const record = importedRecord(file, { title: 'Lick', artist: 'Me' })
    expect(record).toMatchObject({ title: 'Lick', artist: 'Me', ext: 'gp5', bytes: file.bytes })
    expect(record.id.startsWith(IMPORTED_ID_PREFIX)).toBe(true)
  })

  it('names an untitled file after itself, and credits it to "Imported"', () => {
    expect(importedRecord(file, { title: '', artist: '' })).toMatchObject({
      title: 'My Lick.v2',
      artist: 'Imported',
    })
  })
})

describe('newImportId', () => {
  it('is a fresh random id each time', () => {
    const [a, b] = [newImportId(), newImportId()]
    expect(a).toMatch(new RegExp(`^${IMPORTED_ID_PREFIX}[0-9a-f-]{36}$`))
    expect(a).not.toBe(b)
  })

  it('makes do without crypto.randomUUID, as on plain http', () => {
    vi.stubGlobal('crypto', {})
    expect(newImportId()).toMatch(new RegExp(`^${IMPORTED_ID_PREFIX}[0-9a-z]+-[0-9a-z]+$`))
  })
})

describe('readScoreMetadata', () => {
  it("reads the title and artist a file carries, blank where it has none", () => {
    expect(readScoreMetadata(bundled('my-jazz-lick.gp5'))).toEqual({ title: 'MyJazzLick', artist: '' })
    // The book's manifest names this one; the file itself leaves both blank.
    expect(readScoreMetadata(bundled('arpeggios.gp5'))).toEqual({ title: '', artist: '' })
  })

  it('throws for a file alphaTab cannot read', () => {
    expect(() => readScoreMetadata(new TextEncoder().encode('not a tab').buffer)).toThrow()
  })
})

describe('the IndexedDB store', () => {
  it('rejects, rather than throwing, where IndexedDB is missing', async () => {
    await expect(listImported()).rejects.toThrow('IndexedDB is not available in this browser')
  })
})

describe('buildSettings', () => {
  it('scrolls the viewport along with playback, when there is one', () => {
    const viewport = {} as HTMLElement
    expect(buildSettings(viewport).player?.scrollElement).toBe(viewport)
    expect(buildSettings(null).player).not.toHaveProperty('scrollElement')
  })
})
