/**
 * .sbk files: a songbook packed into one zip, so it loads in a single request
 * or from disk. The zip holds songbook.json, either at the root or inside a
 * single top-level folder, plus the files its song URLs point at.
 */

import { type UnzipFileInfo, unzipSync, type Zippable, zipSync } from 'fflate'
import { errorMessage } from '@/lib/utils'

export const MANIFEST = 'songbook.json'
/** gpx and gp are zips already; deflating them again only costs time. */
const PRECOMPRESSED = /\.(gpx|gp)$/i
/** Generous for tabs (the 100-piece Bach book is 0.7 MB), small enough to refuse a zip bomb. */
const MAX_ENTRIES = 5000
const MAX_UNPACKED_BYTES = 200 * 1024 * 1024

export function isZip(bytes: Uint8Array): boolean {
  return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04
}

export interface UnpackedSongbook {
  /** The parsed songbook.json. */
  manifest: unknown
  /** Folder songbook.json sits in, "" or "<dir>/"; song URLs are relative to it. */
  root: string
  /** Decompresses just these entries, by full name inside the zip. */
  read: (names: Set<string>) => Record<string, Uint8Array>
}

/** Reads the manifest and checks the zip's size limits; the files are unpacked on demand. */
export function unpackSongbook(bytes: Uint8Array): UnpackedSongbook {
  const entries: UnzipFileInfo[] = []
  const isManifest = (name: string) => name === MANIFEST || /^[^/]+\/songbook\.json$/.test(name)

  let manifests: Record<string, Uint8Array>
  try {
    // One pass lists every entry (the filter sees them all) but inflates only the manifest.
    manifests = unzipSync(bytes, {
      filter: (file) => {
        entries.push(file)
        return isManifest(file.name)
      },
    })
  } catch (e) {
    throw new Error(`not a readable zip (${errorMessage(e)})`)
  }

  if (entries.length > MAX_ENTRIES) throw new Error(`more than ${MAX_ENTRIES} files`)
  const unpacked = entries.reduce((sum, f) => sum + f.originalSize, 0)
  if (unpacked > MAX_UNPACKED_BYTES) throw new Error('unpacks to more than 200 MB')

  // Prefer a root-level manifest over one in a folder.
  const name = Object.keys(manifests).sort((a, b) => a.length - b.length)[0]
  if (!name) throw new Error(`no ${MANIFEST} inside`)

  let manifest: unknown
  try {
    manifest = JSON.parse(new TextDecoder().decode(manifests[name]))
  } catch {
    throw new Error(`${name} is not JSON`)
  }

  return {
    manifest,
    root: name.slice(0, -MANIFEST.length),
    read: (names) => unzipSync(bytes, { filter: (file) => names.has(file.name) }),
  }
}

/**
 * Zips a manifest and the files it lists (by path) into a .sbk. `level` 0
 * stores without compressing, for a copy that never leaves the browser.
 */
export function packSongbook(
  manifest: unknown,
  files: Record<string, Uint8Array>,
  level: 0 | 6 | 9 = 6,
): Uint8Array {
  const entries: Zippable = {
    [MANIFEST]: new TextEncoder().encode(`${JSON.stringify(manifest, null, 2)}\n`),
  }
  for (const [path, data] of Object.entries(files)) {
    entries[path] = PRECOMPRESSED.test(path) ? [data, { level: 0 }] : data
  }
  return zipSync(entries, { level })
}
