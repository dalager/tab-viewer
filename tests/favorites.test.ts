// Favorites used to be stored as bare ids; they are attached to a book the
// first time one is loaded, and imports to the imported book straight away.

import { describe, expect, it } from 'vitest'
import { migrateFavorites, migrationFor } from '@/lib/favorites'
import { IMPORTED_BOOK, pieceKey } from '@/lib/pieces'

const BACH = 'https://tabs.example/bach.sbk'
const bachAir = pieceKey({ book: BACH, id: 'air' })
const importKey = pieceKey({ book: IMPORTED_BOOK, id: 'imported-1234' })

describe('migrateFavorites', () => {
  it('attaches bare ids to the loaded book', () => {
    expect(migrateFavorites(['air'], BACH)).toEqual(new Set([bachAir]))
  })

  it('attaches bare import ids to the imported book, with or without a loaded book', () => {
    expect(migrateFavorites(['imported-1234'], BACH)).toEqual(new Set([importKey]))
    expect(migrateFavorites(['imported-1234'], null)).toEqual(new Set([importKey]))
  })

  it('keeps bare ids as they are until a book is loaded', () => {
    expect(migrateFavorites(['air'], null)).toEqual(new Set(['air']))
  })

  it('leaves keys that already name their book alone', () => {
    const other = pieceKey({ book: 'local:0b8e', id: 'air' })
    expect(migrateFavorites([other], BACH)).toEqual(new Set([other]))
  })
})

describe('migrationFor', () => {
  it('is null when there is nothing to migrate', () => {
    expect(migrationFor(new Set([bachAir]), BACH)).toBeNull()
    expect(migrationFor(new Set(['air']), null)).toBeNull()
  })

  it('is the migrated set when something changes', () => {
    expect(migrationFor(new Set(['air', importKey]), BACH)).toEqual(new Set([bachAir, importKey]))
  })
})
