import { BookOpen, Download, X } from 'lucide-react'
import { useState } from 'react'
import { Collections } from '@/components/Collections'
import { SectionLabel } from '@/components/SectionLabel'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { UseCollections } from '@/hooks/useCollections'
import type { RememberedBook, UseSongbooks } from '@/hooks/useSongbooks'
import { downloadFile, exportSongbook } from '@/lib/exportSongbook'
import { isLocalBook } from '@/lib/localSongbooks'
import { absoluteBookUrl, type Songbook, SUGGESTED_SONGBOOKS } from '@/lib/songbook'
import { cn, errorMessage } from '@/lib/utils'

export interface SongbookPickerProps {
  songbooks: UseSongbooks
  /** The collections of songbooks added in this browser. */
  collections: UseCollections
  /** Called after a book loads successfully, e.g. to select its first piece. */
  onLoaded: (book: Songbook) => void
  /** Opens the file picker, which takes .sbk songbooks as well as Guitar Pro files. */
  onOpenFile: () => void
}

/** Where a book lives, for display: its URL, or a note for one opened from a file. */
function describeUrl(url: string): string {
  return isLocalBook(url) ? 'Opened from a file, stored in this browser' : url
}

/** Packs the loaded book into a fresh .sbk, whatever form it was loaded in, and downloads it. */
async function downloadBook(book: Songbook): Promise<void> {
  const file = await exportSongbook({
    name: book.name,
    description: book.description ?? '',
    tabs: book.tabs,
    compress: true,
  })
  downloadFile(file)
}

function LoadedBook({ book, onUnload }: { book: Songbook; onUnload: () => void }) {
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const download = async () => {
    setDownloading(true)
    setDownloadError(null)
    try {
      await downloadBook(book)
    } catch (e) {
      setDownloadError(`Could not download: ${errorMessage(e)}`)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <section>
      <SectionLabel>Loaded</SectionLabel>
      <div className="flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
        <BookOpen className="size-4 shrink-0 text-neutral-500" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-neutral-900">{book.name}</p>
          {book.description && (
            <p className="line-clamp-2 text-xs text-neutral-600">{book.description}</p>
          )}
          <p className="truncate text-xs text-neutral-500">
            {book.tabs.length} pieces · {describeUrl(book.url)}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={downloading}
          onClick={() => void download()}
          title="Save this songbook as a .sbk file"
        >
          <Download />
          {downloading ? 'Packing…' : 'Download'}
        </Button>
        <Button variant="outline" size="sm" onClick={onUnload}>
          Unload
        </Button>
      </div>
      {downloadError && (
        <p className="mt-2 text-xs whitespace-pre-line text-red-700">{downloadError}</p>
      )}
    </section>
  )
}

interface UrlFormProps {
  loading: boolean
  error: string | null
  /** Resolves true once the book loaded, so the field can be cleared. */
  onOpen: (url: string) => Promise<boolean>
  onOpenFile: () => void
}

function UrlForm({ loading, error, onOpen, onOpenFile }: UrlFormProps) {
  const [url, setUrl] = useState('')
  const target = url.trim()

  const submit = async () => {
    if (await onOpen(target)) setUrl('')
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (target) void submit()
      }}
    >
      <SectionLabel>Songbook URL</SectionLabel>
      <div className="flex gap-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/songbook.json or .sbk"
          aria-label="Songbook URL"
          className="h-9 bg-white"
        />
        <Button type="submit" disabled={loading || !target}>
          {loading ? 'Loading…' : 'Load'}
        </Button>
      </div>
      <p className="mt-2 text-xs text-neutral-500">
        Or{' '}
        <button type="button" onClick={onOpenFile} className="underline hover:text-neutral-900">
          open a .sbk file
        </button>{' '}
        from your computer, or drop one anywhere.
      </p>
      {error && <p className="mt-2 text-xs whitespace-pre-line text-red-700">{error}</p>}
    </form>
  )
}

interface SuggestionsProps {
  remembered: RememberedBook[]
  loading: boolean
  onOpen: (url: string) => void
}

/** The bundled books not already in the remembered list. */
function Suggestions({ remembered, loading, onOpen }: SuggestionsProps) {
  const known = new Set(remembered.map((b) => b.url))
  const suggestions = SUGGESTED_SONGBOOKS.filter((s) => !known.has(absoluteBookUrl(s.url)))
  if (suggestions.length === 0) return null

  return (
    <section>
      <SectionLabel>Suggested</SectionLabel>
      <ul className="space-y-1">
        {suggestions.map((s) => (
          <li key={s.url}>
            <button
              type="button"
              disabled={loading}
              onClick={() => onOpen(s.url)}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-neutral-700 transition-colors hover:bg-neutral-200 disabled:opacity-50"
            >
              <BookOpen className="size-4 shrink-0 text-neutral-500" />
              {s.name}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

interface RememberedRowProps {
  book: RememberedBook
  active: boolean
  loading: boolean
  onOpen: (url: string) => void
  onForget: (url: string) => void
}

function RememberedRow({ book, active, loading, onOpen, onForget }: RememberedRowProps) {
  return (
    <li className="flex items-center gap-1">
      <button
        type="button"
        disabled={loading}
        onClick={() => onOpen(book.url)}
        className={cn(
          'w-0 flex-1 rounded-md px-2.5 py-1.5 text-left transition-colors disabled:opacity-50',
          active ? 'bg-neutral-900 text-white' : 'text-neutral-700 hover:bg-neutral-200',
        )}
        title={describeUrl(book.url)}
      >
        <span className="block truncate text-sm">{book.name}</span>
        {book.description && (
          <span
            className={cn(
              'block truncate text-xs',
              active ? 'text-neutral-200' : 'text-neutral-600',
            )}
          >
            {book.description}
          </span>
        )}
        <span
          className={cn('block truncate text-xs', active ? 'text-neutral-300' : 'text-neutral-500')}
        >
          {describeUrl(book.url)}
        </span>
      </button>
      <button
        type="button"
        onClick={() => onForget(book.url)}
        className="shrink-0 rounded-md p-1.5 text-neutral-400 transition-colors hover:text-red-600"
        aria-label={`Forget ${book.name}`}
        title="Forget this songbook"
      >
        <X className="size-4" />
      </button>
    </li>
  )
}

interface RememberedListProps extends Omit<RememberedRowProps, 'book' | 'active'> {
  remembered: RememberedBook[]
  activeUrl: string | undefined
  onClearAll: () => void
}

function RememberedList({ remembered, activeUrl, onClearAll, ...row }: RememberedListProps) {
  if (remembered.length === 0) return null
  return (
    <section>
      <div className="flex items-baseline justify-between">
        <SectionLabel>Previously loaded</SectionLabel>
        <button
          type="button"
          onClick={onClearAll}
          className="text-xs text-neutral-500 hover:text-red-600"
        >
          Clear all
        </button>
      </div>
      <ul className="space-y-1">
        {remembered.map((b) => (
          <RememberedRow key={b.url} book={b} active={b.url === activeUrl} {...row} />
        ))}
      </ul>
    </section>
  )
}

/**
 * Everything needed to pick a songbook: a URL field, the bundled suggestions,
 * the books loaded before and the collections added. Shared by the dialog and
 * the empty state.
 */
export function SongbookPicker(props: SongbookPickerProps) {
  const { songbooks, collections, onLoaded, onOpenFile } = props
  const { active, remembered, status, error, load, unload, forget, clearAll } = songbooks
  const loading = status === 'loading'
  const activeUrl = active?.url

  const open = async (target: string) => {
    const book = await load(target)
    if (book) onLoaded(book)
    return book !== null
  }

  return (
    <div className="space-y-5 text-left">
      {active && <LoadedBook book={active} onUnload={unload} />}
      <UrlForm loading={loading} error={error} onOpen={open} onOpenFile={onOpenFile} />
      <Suggestions remembered={remembered} loading={loading} onOpen={(u) => void open(u)} />
      <RememberedList
        remembered={remembered}
        activeUrl={activeUrl}
        loading={loading}
        onOpen={(u) => void open(u)}
        onForget={forget}
        onClearAll={clearAll}
      />
      <Collections
        collections={collections}
        activeUrl={activeUrl}
        loading={loading}
        onOpen={(u) => void open(u)}
      />
    </div>
  )
}

interface SongbookDialogProps extends SongbookPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SongbookDialog({ open, onOpenChange, onLoaded, ...picker }: SongbookDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Songbooks</DialogTitle>
          <DialogDescription>
            A songbook is a JSON file listing Guitar Pro files, or a .sbk file packing them
            into one download. A collection lists songbooks.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[65vh] overflow-y-auto pr-1">
          <SongbookPicker
            {...picker}
            onLoaded={(book) => {
              onLoaded(book)
              onOpenChange(false)
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
