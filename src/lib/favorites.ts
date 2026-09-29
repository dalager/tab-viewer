/**
 * Favorites are stored as pieceKeys. Before that they were bare ids, which
 * named a piece in any songbook at all; those are attached to the book they
 * were most likely starred in the first time one is loaded.
 */

import { IMPORTED_ID_PREFIX } from '@/lib/importedTabs'
import { IMPORTED_BOOK, isBareId, pieceKey } from '@/lib/pieces'

/** The book a bare-id favorite belongs to: imports by their id, anything else by `book`. */
function bookForBareId(id: string, book: string | null): string | null {
  return id.startsWith(IMPORTED_ID_PREFIX) ? IMPORTED_BOOK : book
}

/**
 * Stored favorites with every bare id turned into a pieceKey. Ids that need
 * a songbook stay bare while `book` is null, to be attached once one loads.
 */
export function migrateFavorites(stored: Iterable<string>, book: string | null): Set<string> {
  const migrated = new Set<string>()
  for (const key of stored) {
    const owner = isBareId(key) ? bookForBareId(key, book) : null
    migrated.add(owner === null ? key : pieceKey({ book: owner, id: key }))
  }
  return migrated
}

/** The migrated favorites, or null when migrating now would change nothing. */
export function migrationFor(stored: Set<string>, book: string | null): Set<string> | null {
  const migrated = migrateFavorites(stored, book)
  return [...migrated].some((key) => !stored.has(key)) ? migrated : null
}
