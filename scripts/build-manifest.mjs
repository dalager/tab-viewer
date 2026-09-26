// Builds the bundled "Bach Guitar Songbook".
//
// Reads the scraped CSV index, copies every Guitar Pro file into
// public/songbooks/bach/tabs/ under an ASCII slug name, and emits
// public/songbooks/bach/songbook.json. The same files are also packed into
// public/songbooks/bach.sbk, a zip the app loads in a single request. The app
// loads either like any other songbook URL; nothing about the collection is
// compiled into the bundle.
//
// Run via the `predev` / `prebuild` npm scripts so it always precedes Vite.

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'csv-parse/sync'
import { zipSync } from 'fflate'

const here = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(here, '..')

const CSV = path.join(appRoot, 'collection', 'index.csv')
const SRC_DIR = path.join(appRoot, 'collection', 'tabs')
const BOOK_DIR = path.join(appRoot, 'public', 'songbooks', 'bach')
const OUT_DIR = path.join(BOOK_DIR, 'tabs')
const MANIFEST = path.join(BOOK_DIR, 'songbook.json')
const PACKAGE = path.join(appRoot, 'public', 'songbooks', 'bach.sbk')
const BOOK_NAME = 'Bach Guitar Songbook'

/** ASCII slug: "Suite Nº1" -> "suite-no1". Keeps URLs free of encoding. */
function slugify(value) {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function fail(message) {
  console.error(`\n  build-manifest: ${message}\n`)
  process.exit(1)
}

if (!fs.existsSync(CSV)) fail(`missing CSV index at ${CSV}`)
if (!fs.existsSync(SRC_DIR)) fail(`missing tab directory at ${SRC_DIR}`)

// The CSV is RFC-4180 quoted: two rows carry commas inside quoted fields.
// A naive split(',') corrupts exactly those rows, so use a real parser.
const rows = parse(fs.readFileSync(CSV), {
  columns: true,
  skip_empty_lines: true,
  bom: true,
})

const onDisk = new Set(fs.readdirSync(SRC_DIR).filter((f) => /\.gp[345]$/i.test(f)))
const inCsv = new Set()
const seenSlugs = new Map()
const entries = []

fs.mkdirSync(OUT_DIR, { recursive: true })

let copied = 0
let skipped = 0

for (const row of rows) {
  const filename = row.filename?.trim()
  const title = row.song?.trim()
  if (!filename || !title) fail(`row missing song/filename: ${JSON.stringify(row)}`)

  inCsv.add(filename)
  const source = path.join(SRC_DIR, filename)
  if (!fs.existsSync(source)) fail(`CSV references a file that is not on disk: ${filename}`)

  const ext = path.extname(filename).toLowerCase().slice(1)

  // Dedupe slugs deterministically: second collision becomes "<slug>-2".
  const base = slugify(title) || createHash('sha1').update(filename).digest('hex').slice(0, 8)
  const count = (seenSlugs.get(base) ?? 0) + 1
  seenSlugs.set(base, count)
  const id = count === 1 ? base : `${base}-${count}`

  const target = path.join(OUT_DIR, `${id}.${ext}`)

  // Skip the copy when size+mtime already match, so reruns are instant.
  const srcStat = fs.statSync(source)
  const dstStat = fs.existsSync(target) ? fs.statSync(target) : null
  if (dstStat && dstStat.size === srcStat.size && dstStat.mtimeMs >= srcStat.mtimeMs) {
    skipped++
  } else {
    fs.copyFileSync(source, target)
    copied++
  }

  const entry = {
    id,
    title,
    artist: row.artist?.trim() || 'Bach',
    // Relative to songbook.json, so the folder can be hosted anywhere.
    url: `tabs/${id}.${ext}`,
  }
  const sourceUrl = row.url?.trim()
  if (sourceUrl) entry.sourceUrl = sourceUrl
  entries.push(entry)
}

// Drift in either direction is a real problem: fail loudly rather than
// silently serving a stale or incomplete collection.
const orphaned = [...onDisk].filter((f) => !inCsv.has(f))
if (orphaned.length > 0) {
  fail(`${orphaned.length} file(s) on disk have no CSV row, e.g. ${orphaned.slice(0, 3).join(', ')}`)
}

entries.sort((a, b) => a.title.localeCompare(b.title))
const songbook = { songbook: 1, name: BOOK_NAME, songs: entries }
const manifestJson = `${JSON.stringify(songbook, null, 2)}\n`
fs.writeFileSync(MANIFEST, manifestJson)

// The .sbk holds the same manifest and files, at the same relative paths.
const packed = { 'songbook.json': new TextEncoder().encode(manifestJson) }
for (const entry of entries) {
  packed[entry.url] = fs.readFileSync(path.join(BOOK_DIR, entry.url))
}
fs.writeFileSync(PACKAGE, zipSync(packed, { level: 9 }))

console.log(
  `build-manifest: ${entries.length} tabs (${copied} copied, ${skipped} unchanged) -> public/songbooks/bach/ and bach.sbk`,
)
