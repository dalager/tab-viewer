import { useCallback, useEffect, useState } from 'react'
import { migrationFor } from '@/lib/favorites'
import { type PieceRef, pieceKey } from '@/lib/pieces'

const STORAGE_KEY = 'tab-viewer:favorites'

function load(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

/** A copy of the set with `key` added, or removed if it was there. */
function toggled(keys: Set<string>, key: string): Set<string> {
  const next = new Set(keys)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  return next
}

export interface Favorites {
  isFavorite: (piece: PieceRef) => boolean
  toggleFavorite: (piece: PieceRef) => void
}

/**
 * Starred pieces, by book and id, persisted to localStorage. `book` is the
 * loaded songbook's URL: favorites stored as bare ids by older versions are
 * attached to the first book that loads.
 */
export function useFavorites(book: string | null): Favorites {
  const [favorites, setFavorites] = useState<Set<string>>(load)

  // Adjusted during render so the migrated set is what the first paint sees.
  const migrated = migrationFor(favorites, book)
  if (migrated) setFavorites(migrated)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...favorites]))
  }, [favorites])

  const isFavorite = useCallback((piece: PieceRef) => favorites.has(pieceKey(piece)), [favorites])

  const toggleFavorite = useCallback((piece: PieceRef) => {
    setFavorites((prev) => toggled(prev, pieceKey(piece)))
  }, [])

  return { isFavorite, toggleFavorite }
}
