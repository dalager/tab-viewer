// Publishes the bundled songbooks: copies every songbooks/*.sbk into
// public/songbooks/ so Vite serves them at /songbooks/<name>.sbk.
//
// Run via the `predev` / `prebuild` npm scripts so it always precedes Vite.
// public/songbooks/ is generated and git-ignored; it is rebuilt from scratch
// each run so a removed or renamed book does not linger.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC_DIR = path.join(appRoot, 'songbooks')
const OUT_DIR = path.join(appRoot, 'public', 'songbooks')

const books = fs.readdirSync(SRC_DIR).filter((f) => f.endsWith('.sbk'))
if (books.length === 0) {
  console.error(`\n  copy-songbooks: no .sbk files in ${SRC_DIR}\n`)
  process.exit(1)
}

fs.rmSync(OUT_DIR, { recursive: true, force: true })
fs.mkdirSync(OUT_DIR, { recursive: true })
for (const book of books) fs.copyFileSync(path.join(SRC_DIR, book), path.join(OUT_DIR, book))

console.log(`copy-songbooks: ${books.join(', ')} -> public/songbooks/`)
