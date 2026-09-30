// .sbk files: what unpacking refuses, and how packing stores each file.

import { unzipSync, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { isZip, MANIFEST, packSongbook, unpackSongbook } from '@/lib/sbk'

const text = (s: string) => new TextEncoder().encode(s)
const MANIFEST_JSON = text(JSON.stringify({ songs: [] }))

/**
 * A zip whose central directory claims `size` unpacked bytes for its one
 * other entry, without holding them: the size check reads only the directory.
 */
function zipClaiming(size: number): Uint8Array {
  const zip = zipSync({ [MANIFEST]: MANIFEST_JSON, 'tabs/big.gp5': text('x') })
  const view = new DataView(zip.buffer)
  for (let i = 0; i < zip.length - 4; i++) {
    // Central directory header; the second one is tabs/big.gp5.
    if (view.getUint32(i, true) !== 0x02014b50) continue
    const nameLength = view.getUint16(i + 28, true)
    const name = new TextDecoder().decode(zip.subarray(i + 46, i + 46 + nameLength))
    if (name === 'tabs/big.gp5') view.setUint32(i + 24, size, true)
  }
  return zip
}

describe('unpackSongbook', () => {
  it('reads songbook.json at the root, and says where it is', () => {
    const { manifest, root } = unpackSongbook(zipSync({ [MANIFEST]: MANIFEST_JSON }))
    expect(manifest).toEqual({ songs: [] })
    expect(root).toBe('')
  })

  it('prefers a root songbook.json over one in a folder', () => {
    const zip = zipSync({
      'book/songbook.json': text(JSON.stringify({ name: 'folder' })),
      [MANIFEST]: text(JSON.stringify({ name: 'root' })),
    })
    expect(unpackSongbook(zip).manifest).toEqual({ name: 'root' })
  })

  it('refuses bytes that are not a zip', () => {
    expect(() => unpackSongbook(text('PK\x03\x04 but then nonsense'))).toThrow(/not a readable zip/)
  })

  it('refuses a zip without songbook.json', () => {
    expect(() => unpackSongbook(zipSync({ 'tabs/air.gp5': text('x') }))).toThrow(
      /no songbook\.json inside/,
    )
  })

  it('refuses a songbook.json that is not JSON', () => {
    expect(() => unpackSongbook(zipSync({ [MANIFEST]: text('{ nope') }))).toThrow(
      /songbook\.json is not JSON/,
    )
  })

  it('refuses a zip with more than 5000 files', () => {
    const files: Record<string, Uint8Array> = { [MANIFEST]: MANIFEST_JSON }
    for (let i = 0; i < 5000; i++) files[`tabs/${i}.gp5`] = new Uint8Array(0)
    expect(() => unpackSongbook(zipSync(files, { level: 0 }))).toThrow(/more than 5000 files/)
  })

  it('refuses a zip that would unpack to more than 200 MB', () => {
    expect(() => unpackSongbook(zipClaiming(200 * 1024 * 1024 + 1))).toThrow(/more than 200 MB/)
    expect(() => unpackSongbook(zipClaiming(1024))).not.toThrow()
  })
})

describe('packSongbook', () => {
  it('stores gpx and gp files as they are, since they are zips already', () => {
    const zip = packSongbook({ songs: [] }, { 'tabs/a.gpx': text('a'.repeat(500)), 'tabs/b.gp5': text('b'.repeat(500)) })
    const methods: Record<string, number> = {}
    unzipSync(zip, {
      filter: (file) => {
        methods[file.name] = file.compression
        return false
      },
    })
    expect(methods['tabs/a.gpx']).toBe(0)
    expect(methods['tabs/b.gp5']).toBe(8)
    expect(isZip(zip)).toBe(true)
  })
})
