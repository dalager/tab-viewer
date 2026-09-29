/**
 * Piece identity. A piece's id is only unique within its songbook, so a piece
 * is named by its book and its id together; this module is the one place
 * that knows how. Imports belong to the IMPORTED_BOOK, which lives only in
 * this browser.
 */

/** The book every imported piece belongs to. Never a real URL. */
export const IMPORTED_BOOK = 'imported:'

/** A piece: the book it belongs to (a book URL, or IMPORTED_BOOK) and its id there. */
export interface PieceRef {
  book: string
  id: string
}

/**
 * A piece to open. `book` is null when only the id is known: a link without
 * `?book=`, or a selection stored before pieces were stored with their book.
 * Such a target matches the piece with that id in whichever book has it.
 */
export interface PieceTarget {
  id: string
  book: string | null
}

/** Ids are slugs, so they never contain this; book URLs may. */
const SEPARATOR = '#'

/** A string naming the piece, for storage keys, React keys and sets. */
export function pieceKey({ book, id }: PieceRef): string {
  return `${book}${SEPARATOR}${id}`
}

/** Reads a pieceKey back; a bare id, as stored before keys existed, has no book. */
export function parsePieceKey(key: string): PieceTarget {
  const at = key.lastIndexOf(SEPARATOR)
  if (at < 0) return { id: key, book: null }
  return { book: key.slice(0, at), id: key.slice(at + 1) }
}

/** Whether a stored string is a bare id from before pieces were stored with their book. */
export function isBareId(key: string): boolean {
  return !key.includes(SEPARATOR)
}

export function isImported(piece: Pick<PieceRef, 'book'>): boolean {
  return piece.book === IMPORTED_BOOK
}

/** Whether two books can be the same: equal, or one of them unknown. */
function booksAgree(a: string | null, b: string | null): boolean {
  return a === null || b === null || a === b
}

/** Whether two targets can name the same piece; a PieceRef is a target too. */
export function sameTarget(a: PieceTarget | null, b: PieceTarget | null): boolean {
  return a !== null && b !== null && a.id === b.id && booksAgree(a.book, b.book)
}
