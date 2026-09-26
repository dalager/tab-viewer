import { Star, X } from 'lucide-react'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useFavorites } from '@/hooks/useFavorites'
import { cn, filterTabs } from '@/lib/utils'
import type { TabEntry } from '@/types'

interface TabSidebarProps {
  tabs: TabEntry[]
  /** Heading for the songbook's pieces; falls back to "Songbook". */
  bookName: string | null
  selectedId: string | null
  onSelect: (id: string) => void
  /** Called for pieces with `imported` set; they get a remove button. */
  onRemove: (id: string) => void
  /** Opens the dialog that packs chosen pieces into a new songbook. */
  onExport: () => void
}

/**
 * Section label to show above row `i`, if it starts a new section. Labels are
 * only needed when there is more than one section.
 */
function sectionHeading(
  shown: TabEntry[],
  i: number,
  labelled: boolean,
  bookLabel: string,
): string | null {
  if (!labelled) return null
  const tab = shown[i]
  if (i === 0) return tab.imported ? 'Imported' : bookLabel
  return shown[i - 1].imported && !tab.imported ? bookLabel : null
}

function SectionHeading({ children }: { children: string }) {
  return (
    <h3 className="w-full px-2.5 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
      {children}
    </h3>
  )
}

/** Rows rendered initially, and added each time the sentinel comes into view. */
const PAGE_SIZE = 60

export function TabSidebar({
  tabs,
  bookName,
  selectedId,
  onSelect,
  onRemove,
  onExport,
}: TabSidebarProps) {
  const [query, setQuery] = useState('')
  const hasImports = useMemo(() => tabs.some((t) => t.imported), [tabs])
  const [visible, setVisible] = useState(PAGE_SIZE)
  const sentinelRef = useRef<HTMLLIElement>(null)
  const { favorites, isFavorite, toggleFavorite } = useFavorites()

  const filtered = useMemo(() => filterTabs(tabs, query), [tabs, query])

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

  // Starred pieces are repeated at the top rather than moved there, so starring
  // a row does not make it jump out from under the pointer. Few enough that
  // they need no paging.
  const starred = useMemo(
    () => filtered.filter((t) => favorites.has(t.id)),
    [filtered, favorites],
  )
  const labelled = hasImports || starred.length > 0

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

  function renderRow(tab: TabEntry, keyPrefix = '') {
    const favorite = isFavorite(tab.id)
    return (
      <li key={keyPrefix + tab.id} className="flex items-center gap-1">
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
          <Star className={cn('size-4', favorite && 'fill-amber-400 text-amber-500')} />
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
  }

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
        <div className="mt-2 flex items-baseline justify-between text-xs text-neutral-500">
          <p>
            {filtered.length} of {tabs.length}
          </p>
          <button
            type="button"
            onClick={onExport}
            disabled={tabs.length === 0}
            className="hover:text-neutral-900 disabled:opacity-50"
            title="Pack pieces into a new .sbk songbook (e)"
          >
            Export…
          </button>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <ul className="p-2">
          {starred.length > 0 && (
            <li>
              <SectionHeading>Starred</SectionHeading>
            </li>
          )}
          {starred.map((tab) => renderRow(tab, 'starred:'))}

          {shown.map((tab, i) => {
            const heading = sectionHeading(shown, i, labelled, bookName ?? 'Songbook')
            return heading ? (
              <Fragment key={tab.id}>
                <li>
                  <SectionHeading>{heading}</SectionHeading>
                </li>
                {renderRow(tab)}
              </Fragment>
            ) : (
              renderRow(tab)
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
