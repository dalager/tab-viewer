import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { TabEntry } from '@/types'

interface TabSidebarProps {
  tabs: TabEntry[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function TabSidebar({ tabs, selectedId, onSelect }: TabSidebarProps) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return tabs
    return tabs.filter((t) => t.title.toLowerCase().includes(q))
  }, [tabs, query])

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

      <ScrollArea className="flex-1">
        <ul className="p-2">
          {filtered.map((tab) => (
            <li key={tab.id}>
              <button
                type="button"
                onClick={() => onSelect(tab.id)}
                className={cn(
                  'w-full truncate rounded-md px-2.5 py-1.5 text-left text-sm transition-colors',
                  tab.id === selectedId
                    ? 'bg-neutral-900 text-white'
                    : 'text-neutral-700 hover:bg-neutral-200',
                )}
                title={tab.title}
              >
                {tab.title}
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-2.5 py-6 text-center text-sm text-neutral-500">No matches</li>
          )}
        </ul>
      </ScrollArea>
    </aside>
  )
}
