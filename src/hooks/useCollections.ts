import { useCallback, useEffect, useState } from 'react'
import { resolveCollection } from '@/lib/collectionClient'
import { withoutAddCollection } from '@/lib/permalink'
import {
  COLLECTIONS_KEY,
  parseSaved,
  type SavedCollection,
  withAdded,
  without,
} from '@/lib/savedCollections'

export interface UseCollections {
  /** The collections added in this browser, in the order they were added. */
  saved: SavedCollection[]
  /** Why the last collection could not be added, cleared by the next one that is. */
  error: string | null
  /** Whether a collection is being fetched to add it. */
  adding: boolean
  /** Fetches a collection and, if it is one, saves it. Resolves true once saved. */
  add: (input: string) => Promise<boolean>
  /** Takes a collection off the list; books loaded from it stay remembered. */
  remove: (url: string) => void
}

function loadSaved(): SavedCollection[] {
  return parseSaved(localStorage.getItem(COLLECTIONS_KEY))
}

interface AddContext {
  setSaved: (update: (prev: SavedCollection[]) => SavedCollection[]) => void
  setError: (message: string | null) => void
  setAdding: (adding: boolean) => void
}

/** Fetches what was typed or linked and saves it if it is a collection; true once saved. */
async function addCollection(input: string, ctx: AddContext): Promise<boolean> {
  const outcome = await resolveCollection(input, window.location.origin)
  ctx.setAdding(false)
  if ('error' in outcome) {
    ctx.setError(`Could not add collection: ${outcome.error}`)
    return false
  }
  ctx.setError(null)
  ctx.setSaved((prev) => withAdded(prev, outcome.saved))
  return true
}

/**
 * The collections of songbooks this browser knows, kept in localStorage.
 * `linked` is the collection the address asked to add at startup; it is added
 * like one typed in, and taken out of the address so a reload does not ask again.
 */
export function useCollections(linked: string | null): UseCollections {
  const [saved, setSaved] = useState<SavedCollection[]>(loadSaved)
  const [error, setError] = useState<string | null>(null)
  // True from the first render for a linked collection, like a book to start with.
  const [adding, setAdding] = useState(linked !== null)

  useEffect(() => {
    localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(saved))
  }, [saved])

  /** Callers set `adding` themselves; the startup effect must not set state synchronously. */
  const run = useCallback((input: string) => addCollection(input, { setSaved, setError, setAdding }), [])

  const add = useCallback(
    (input: string) => {
      setAdding(true)
      return run(input)
    },
    [run],
  )

  // The linked collection. `adding` was initialised to true for it.
  useEffect(() => {
    if (linked) void run(linked)
  }, [linked, run])

  useEffect(() => {
    if (linked) window.history.replaceState(null, '', withoutAddCollection())
  }, [linked])

  const remove = useCallback((url: string) => {
    setSaved((prev) => without(prev, url))
  }, [])

  return { saved, error, adding, add, remove }
}
