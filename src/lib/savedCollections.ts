/** The collections a user has added, as kept in localStorage. */

import { isRecord } from '@/lib/songbook'

export const COLLECTIONS_KEY = 'tab-viewer:collections'

export interface SavedCollection {
  /** The collection's address as normalised by collectionUrl; its identity. */
  url: string
  /** Its name when it was added, shown while it loads or cannot be reached. */
  name: string
}

function isSaved(value: unknown): value is SavedCollection {
  return isRecord(value) && typeof value.url === 'string' && typeof value.name === 'string'
}

/** The stored list; anything unreadable counts as no collections. */
export function parseSaved(raw: string | null): SavedCollection[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isSaved) : []
  } catch {
    return []
  }
}

/** The list with this collection at the end, or updated in place if it was there already. */
export function withAdded(list: SavedCollection[], entry: SavedCollection): SavedCollection[] {
  return list.some((c) => c.url === entry.url)
    ? list.map((c) => (c.url === entry.url ? entry : c))
    : [...list, entry]
}

export function without(list: SavedCollection[], url: string): SavedCollection[] {
  return list.filter((c) => c.url !== url)
}
