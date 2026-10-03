// Turns a folder of .sbk songbooks into a collection: writes
// <folder>/collection.json listing every .sbk in it, with the name,
// description and piece count read from each book's own manifest.
//
//   node scripts/make-collection.mjs <folder> [--name "…"] [--description "…"]
//
// Host the folder anywhere that allows cross-origin GET and add its address
// in the app. Run it again after adding, replacing or removing a book. The
// format is public/schema/collection-1.schema.json.

import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { unzipSync } from 'fflate'

const SCHEMA = 'https://tabviewer.dalagerlabs.com/schema/collection-1.schema.json'
const OUT_FILE = 'collection.json'
const isManifest = (name) => name === 'songbook.json' || /^[^/]+\/songbook\.json$/.test(name)

function fail(message) {
  console.error(`\n  make-collection: ${message}\n`)
  process.exit(1)
}

/** The parsed songbook.json of a .sbk, preferring a root-level one as the app does. */
function readManifest(file) {
  let manifests
  try {
    manifests = unzipSync(new Uint8Array(fs.readFileSync(file)), { filter: (f) => isManifest(f.name) })
  } catch (e) {
    fail(`${file} is not a readable zip (${e.message})`)
  }
  const name = Object.keys(manifests).sort((a, b) => a.length - b.length)[0]
  if (!name) fail(`${file} has no songbook.json inside`)
  try {
    return JSON.parse(new TextDecoder().decode(manifests[name]))
  } catch {
    fail(`${file}: ${name} is not JSON`)
  }
}

const text = (value) => (typeof value === 'string' && value.trim() ? value.trim() : undefined)

/** One book's entry; keys left undefined are dropped when the document is written. */
function bookEntry(dir, fileName) {
  const file = path.join(dir, fileName)
  const manifest = readManifest(file)
  const stat = fs.statSync(file)
  return {
    url: encodeURIComponent(fileName),
    name: text(manifest.name) ?? path.basename(fileName, '.sbk'),
    description: text(manifest.description),
    songs: Array.isArray(manifest.songs) ? manifest.songs.length : undefined,
    size: stat.size,
    updated: stat.mtime.toISOString(),
  }
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { name: { type: 'string' }, description: { type: 'string' } },
})
const [folder] = positionals
if (!folder) fail('usage: node scripts/make-collection.mjs <folder> [--name "…"] [--description "…"]')

const dir = path.resolve(folder)
if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) fail(`${dir} is not a folder`)

const files = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith('.sbk'))
  .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
if (files.length === 0) fail(`no .sbk files in ${dir}`)

const collection = {
  $schema: SCHEMA,
  collection: 1,
  name: text(values.name) ?? path.basename(dir),
  description: text(values.description),
  books: files.map((f) => bookEntry(dir, f)),
}

fs.writeFileSync(path.join(dir, OUT_FILE), `${JSON.stringify(collection, null, 2)}\n`)
console.log(`make-collection: ${files.length} book(s) -> ${path.join(dir, OUT_FILE)}`)
