import { useCallback, useEffect, useMemo, useState } from 'react'
import { type CollectionResult, fetchCollection, listings } from '@/lib/collectionClient'
import type { SavedCollection } from '@/lib/savedCollections'

/** The results without that collection's, so it reads as loading again. */
function withoutResult(
  results: Record<string, CollectionResult>,
  url: string,
): Record<string, CollectionResult> {
  return Object.fromEntries(Object.entries(results).filter(([key]) => key !== url))
}

/**
 * What each saved collection lists right now. They are fetched when the
 * picker mounts and whenever the saved list changes, each on its own, so a
 * slow or broken one does not hold up the rest.
 */
export function useCollectionListings(saved: SavedCollection[]) {
  const [results, setResults] = useState<Record<string, CollectionResult>>({})
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    for (const { url } of saved) {
      void fetchCollection(new URL(url)).then((result) => {
        if (!cancelled) setResults((prev) => ({ ...prev, [url]: result }))
      })
    }
    return () => {
      cancelled = true
    }
  }, [saved, attempt])

  /** Fetches the collections again, showing this one as loading meanwhile. */
  const retry = useCallback((url: string) => {
    setResults((prev) => withoutResult(prev, url))
    setAttempt((n) => n + 1)
  }, [])

  return { listings: useMemo(() => listings(saved, results), [saved, results]), retry }
}
