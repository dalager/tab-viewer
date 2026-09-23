import { Star, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useFavorites } from '@/hooks/useFavorites'
import { cn } from '@/lib/utils'
import type { TabEntry } from '@/types'

interface TabSidebarProps {
  tabs: TabEntry[]
  selectedId: string | null
  onSelect: (id: string) => void
  /** Called for pieces with `imported` set; they get a remove button. */
  onRemove: (id: string) => void
}

/** Section label to show above row `i`, if it starts a new section. */
function sectionHeading(shown: TabEntry[], i: number, hasImports: boolean): string | null {
  if (!hasImports) return null
  const tab = shown[i]
  if (i === 0) return tab.imported ? 'Imported' : 'Collection'
  return shown[i - 1].imported && !tab.imported ? 'Collection' : null
}

/** Rows rendered initially, and added each time the sentinel comes into view. */
const PAGE_SIZE = 60

export function TabSidebar({ tabs, selectedId, onSelect, onRemove }: TabSidebarProps) {
  const [query, setQuery] = useState('')
  const hasImports = useMemo(() => tabs.some((t) => t.imported), [tabs])
  const [visible, setVisible] = useState(PAGE_SIZE)
  const sentinelRef = useRef<HTMLLIElement>(null)
  const { isFavorite, toggleFavorite } = useFavorites()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return tabs
    return tabs.filter((t) => t.title.toLowerCase().includes(q))
  }, [tabs, query])

  // A new filter starts a new list, so go back to the first page. Adjusting
  // during render (rather than in an effect) avoids a throwaway second pass.
  const [lastQuery, setLastQuery] = useState(query)
  if (lastQuery !== query) {
    setLastQuery(query)
    setVisible(PAGE_SIZE)
  }

  // Jumping to a piece past the current page (n/p, or the palette) must not
  // hide it from the list, so extend far enough to include it. Derived rather
  // than stored: there is nothing to keep in sync.
  const selectedIndex = selectedId ? filtered.findIndex((t) => t.id === selectedId) : -1
  const needed = selectedIndex >= 0 ? Math.ceil((selectedIndex + 1) / PAGE_SIZE) * PAGE_SIZE : 0
  const effectiveVisible = Math.max(visible, needed)

  const shown = filtered.slice(0, effectiveVisible)
  const hasMore = effectiveVisible < filtered.length

  // Grow the list when the sentinel scrolls into the ScrollArea's viewport.
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasMore) return

    // Radix renders the scrollable element as the viewport, not the root.
    const root = sentinel.closest('[data-radix-scroll-area-viewport]')
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(Math.min(effectiveVisible + PAGE_SIZE, filtered.length))
        }
      },
      { root, rootMargin: '200px' },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, effectiveVisible, filtered.length])

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-neutral-200 bg-neutral-50">
      <div className="border-b border-neutral-200 p-3">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter pieces…"
          aria-label="Filter pieces"
          className="h-9 bg-white"
        />
        <p className="mt-2 text-xs text-neutral-500">
          {filtered.length} of {tabs.length}
        </p>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <ul className="p-2">
          {shown.map((tab, i) => {
            const favorite = isFavorite(tab.id)
            const heading = sectionHeading(shown, i, hasImports)
            return (
              <li key={tab.id} className="flex flex-wrap items-center gap-1">
                {heading && (
                  <h3 className="w-full px-2.5 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    {heading}
                  </h3>
                )}
                <button
                  type="button"
                  onClick={() => onSelect(tab.id)}
                  className={cn(
                    'w-0 flex-1 truncate rounded-md px-2.5 py-1.5 text-left text-sm transition-colors',
                    tab.id === selectedId
                      ? 'bg-neutral-900 text-white'
                      : 'text-neutral-700 hover:bg-neutral-200',
                  )}
                  title={tab.title}
                >
                  {tab.title}
                </button>
                <button
                  type="button"
                  onClick={() => toggleFavorite(tab.id)}
                  className="shrink-0 rounded-md p-1.5 text-neutral-400 transition-colors hover:text-amber-500"
                  aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
                  aria-pressed={favorite}
                  title={favorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <Star
                    className={cn('size-4', favorite && 'fill-amber-400 text-amber-500')}
                  />
                </button>
                {tab.imported && (
                  <button
                    type="button"
                    onClick={() => onRemove(tab.id)}
                    className="shrink-0 rounded-md p-1.5 text-neutral-400 transition-colors hover:text-red-600"
                    aria-label="Remove imported piece"
                    title="Remove imported piece"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </li>
            )
          })}

          {hasMore && (
            <li ref={sentinelRef} className="px-2.5 py-3 text-center text-xs text-neutral-400">
              Loading {Math.min(PAGE_SIZE, filtered.length - effectiveVisible)} more…
            </li>
          )}

          {filtered.length === 0 && (
            <li className="px-2.5 py-6 text-center text-sm text-neutral-500">No matches</li>
          )}
        </ul>
      </ScrollArea>
    </aside>
  )
}
