// Piece identity: a piece is its book plus its id, since ids only have to
// be unique within one songbook.

import { describe, expect, it } from 'vitest'
import {
  IMPORTED_BOOK,
  isBareId,
  isImported,
  parsePieceKey,
  pieceKey,
  sameTarget,
} from '@/lib/pieces'

const BACH = 'https://tabs.example/bach.sbk'
const COPY = 'local:0b8e'

describe('pieceKey', () => {
  it('reads back as the same book and id', () => {
    expect(parsePieceKey(pieceKey({ book: BACH, id: 'air' }))).toEqual({ book: BACH, id: 'air' })
  })

  it('reads back book URLs that contain the separator themselves', () => {
    const book = 'https://tabs.example/book.json#v2'
    expect(parsePieceKey(pieceKey({ book, id: 'air' }))).toEqual({ book, id: 'air' })
  })

  it('tells the same id in two books apart', () => {
    expect(pieceKey({ book: BACH, id: 'air' })).not.toBe(pieceKey({ book: COPY, id: 'air' }))
  })

  it('reads a bare id, as stored before keys existed, as an id with no book', () => {
    expect(parsePieceKey('air')).toEqual({ id: 'air', book: null })
    expect(isBareId('air')).toBe(true)
    expect(isBareId(pieceKey({ book: BACH, id: 'air' }))).toBe(false)
  })
})

describe('sameTarget', () => {
  it('matches the same id in the same book', () => {
    expect(sameTarget({ book: BACH, id: 'air' }, { book: BACH, id: 'air' })).toBe(true)
  })

  it('does not match the same id in another book', () => {
    expect(sameTarget({ book: BACH, id: 'air' }, { book: COPY, id: 'air' })).toBe(false)
  })

  it('matches by id alone when either side has no book', () => {
    expect(sameTarget({ book: BACH, id: 'air' }, { book: null, id: 'air' })).toBe(true)
    expect(sameTarget({ book: null, id: 'air' }, { book: COPY, id: 'air' })).toBe(true)
    expect(sameTarget({ book: null, id: 'air' }, { book: null, id: 'gigue' })).toBe(false)
  })

  it('matches nothing when either side is missing', () => {
    expect(sameTarget(null, { book: BACH, id: 'air' })).toBe(false)
    expect(sameTarget({ book: BACH, id: 'air' }, null)).toBe(false)
  })
})

describe('isImported', () => {
  it('is true only for the imported book', () => {
    expect(isImported({ book: IMPORTED_BOOK })).toBe(true)
    expect(isImported({ book: BACH })).toBe(false)
  })
})
