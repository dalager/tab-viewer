import { memo, useCallback, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { Favorites } from '@/hooks/useFavorites'
import { downloadFile, exportSongbook } from '@/lib/exportSongbook'
import { isImported, pieceKey } from '@/lib/pieces'
import { errorMessage, filterTabs } from '@/lib/utils'
import type { TabEntry } from '@/types'

interface ExportFormProps {
  /** Pieces to choose from: the loaded songbook's and the imported ones. */
  tabs: TabEntry[]
  bookName: string | null
  favorites: Favorites
  /** Stores the new .sbk in this browser and switches to it. */
  onSaveAndOpen: (file: File) => Promise<unknown>
  onDone: () => void
}

/** A copy of the selection with every pieceKey in `keys` switched on or off. */
function withKeys(selected: Set<string>, keys: string[], on: boolean): Set<string> {
  const next = new Set(selected)
  for (const key of keys) {
    if (on) next.add(key)
    else next.delete(key)
  }
  return next
}

const keysOf = (tabs: TabEntry[]) => tabs.map(pieceKey)

/**
 * Mounted only while the dialog is open, so each opening starts fresh: the
 * starred pieces preselected and favorites read as they are now.
 */
function ExportForm({ tabs, bookName, favorites, onSaveAndOpen, onDone }: ExportFormProps) {
  const { isFavorite } = favorites
  const starredKeys = useMemo(() => keysOf(tabs.filter(isFavorite)), [tabs, isFavorite])
  const [name, setName] = useState(() => (bookName ? `${bookName} (selection)` : 'My songbook'))
  const [description, setDescription] = useState('')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(() => new Set(starredKeys))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const shown = useMemo(() => filterTabs(tabs, query), [tabs, query])

  const setMany = useCallback(
    (keys: string[], on: boolean) => setSelected((prev) => withKeys(prev, keys, on)),
    [],
  )

  const run = async (compress: boolean, then: (file: File) => unknown) => {
    setBusy(true)
    setError(null)
    try {
      // Keep the list's order rather than the order pieces were ticked in.
      const file = await exportSongbook({
        name,
        description,
        tabs: tabs.filter((t) => selected.has(pieceKey(t))),
        compress,
      })
      await then(file)
      onDone()
    } catch (e) {
      setError(`Could not export: ${errorMessage(e)}`)
    } finally {
      setBusy(false)
    }
  }

  const canExport = !busy && selected.size > 0 && name.trim() !== ''

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (canExport) void run(true, downloadFile)
      }}
    >
      <div className="grid gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Songbook name"
          aria-label="Songbook name"
          className="h-9"
        />
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          aria-label="Description"
          className="max-h-32"
        />
      </div>

      <div className="grid gap-2">
        <div className="flex items-center gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter pieces…"
            aria-label="Filter pieces to export"
            className="h-8 flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={starredKeys.length === 0}
            onClick={() => setSelected(new Set(starredKeys))}
          >
            Starred
          </Button>
          {/* All and None act on what the filter shows, so a filter can pick a subset. */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setMany(keysOf(shown), true)}
          >
            All
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setMany(keysOf(shown), false)}
          >
            None
          </Button>
        </div>

        <PieceChecklist tabs={shown} selected={selected} onChange={setMany} />
        <p className="text-xs text-neutral-500">
          {selected.size} of {tabs.length} selected
        </p>
      </div>

      {error && <p className="text-xs whitespace-pre-line text-red-700">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!canExport}
          onClick={() => void run(false, onSaveAndOpen)}
          title="Keep the new songbook in this browser and switch to it"
        >
          Save &amp; open
        </Button>
        <Button type="submit" disabled={!canExport}>
          {busy ? 'Exporting…' : 'Download .sbk'}
        </Button>
      </div>
    </form>
  )
}

interface PieceChecklistProps {
  tabs: TabEntry[]
  selected: Set<string>
  onChange: (ids: string[], on: boolean) => void
}

/** Memoized so typing a name or description does not re-render every row. */
const PieceChecklist = memo(function PieceChecklist({
  tabs,
  selected,
  onChange,
}: PieceChecklistProps) {
  return (
    <ul className="h-72 overflow-y-auto rounded-md border border-neutral-200 p-1">
      {tabs.map((tab) => (
        <li key={pieceKey(tab)}>
          <label className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 hover:bg-neutral-100">
            <Checkbox
              checked={selected.has(pieceKey(tab))}
              onCheckedChange={(on) => onChange([pieceKey(tab)], on === true)}
            />
            <span className="min-w-0 flex-1 truncate text-sm text-neutral-800">{tab.title}</span>
            {isImported(tab) && <span className="text-xs text-neutral-400">Imported</span>}
          </label>
        </li>
      ))}
      {tabs.length === 0 && (
        <li className="px-2 py-6 text-center text-sm text-neutral-500">No matches</li>
      )}
    </ul>
  )
})

interface ExportDialogProps extends Omit<ExportFormProps, 'onDone'> {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Pick pieces and pack them into a new .sbk songbook. */
export function ExportDialog({ open, onOpenChange, ...form }: ExportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Export songbook</DialogTitle>
          <DialogDescription>
            Pack the pieces you pick into a .sbk file you can share or open later.
          </DialogDescription>
        </DialogHeader>
        <ExportForm {...form} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}
