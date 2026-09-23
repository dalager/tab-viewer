import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'tab-viewer:favorites'

function load(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

/** Favorite tab ids, persisted to localStorage as a JSON array. */
export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(load)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...favorites]))
  }, [favorites])

  const isFavorite = useCallback((id: string) => favorites.has(id), [favorites])

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  return { favorites, isFavorite, toggleFavorite }
}
