import { BookOpen, Download, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { UseSongbooks } from '@/hooks/useSongbooks'
import { downloadFile, exportSongbook } from '@/lib/exportSongbook'
import { isLocalBook } from '@/lib/localSongbooks'
import { absoluteBookUrl, type Songbook, SUGGESTED_SONGBOOKS } from '@/lib/songbook'
import { cn, errorMessage } from '@/lib/utils'

interface SongbookPickerProps {
  songbooks: UseSongbooks
  /** Called after a book loads successfully, e.g. to select its first piece. */
  onLoaded: (book: Songbook) => void
  /** Opens the file picker, which takes .sbk songbooks as well as Guitar Pro files. */
  onOpenFile: () => void
}

/** Where a book lives, for display: its URL, or a note for one opened from a file. */
function describeUrl(url: string): string {
  return isLocalBook(url) ? 'Opened from a file, stored in this browser' : url
}

function SectionLabel({ children }: { children: string }) {
  return (
    <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
      {children}
    </h3>
  )
}

/**
 * Everything needed to pick a songbook: a URL field, the bundled suggestions
 * and the books loaded before. Shared by the dialog and the empty state.
 */
export function SongbookPicker({ songbooks, onLoaded, onOpenFile }: SongbookPickerProps) {
  const { active, remembered, loading, error, load, unload, forget, clearAll } = songbooks
  const [url, setUrl] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  /** Packs the loaded book into a fresh .sbk, whatever form it was loaded in. */
  const download = async (book: Songbook) => {
    setDownloading(true)
    setDownloadError(null)
    try {
      const file = await exportSongbook({
        name: book.name,
        description: book.description ?? '',
        tabs: book.tabs,
        compress: true,
      })
      downloadFile(file)
    } catch (e) {
      setDownloadError(`Could not download: ${errorMessage(e)}`)
    } finally {
      setDownloading(false)
    }
  }

  const open = async (target: string) => {
    const book = await load(target)
    if (!book) return
    setUrl('')
    onLoaded(book)
  }

  const known = new Set(remembered.map((b) => b.url))
  const suggestions = SUGGESTED_SONGBOOKS.filter((s) => !known.has(absoluteBookUrl(s.url)))

  return (
    <div className="space-y-5 text-left">
      {active && (
        <section>
          <SectionLabel>Loaded</SectionLabel>
          <div className="flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
            <BookOpen className="size-4 shrink-0 text-neutral-500" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-neutral-900">{active.name}</p>
              {active.description && (
                <p className="line-clamp-2 text-xs text-neutral-600">{active.description}</p>
              )}
              <p className="truncate text-xs text-neutral-500">
                {active.tabs.length} pieces · {describeUrl(active.url)}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={downloading}
              onClick={() => void download(active)}
              title="Save this songbook as a .sbk file"
            >
              <Download />
              {downloading ? 'Packing…' : 'Download'}
            </Button>
            <Button variant="outline" size="sm" onClick={unload}>
              Unload
            </Button>
          </div>
          {downloadError && (
            <p className="mt-2 text-xs whitespace-pre-line text-red-700">{downloadError}</p>
          )}
        </section>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (url.trim()) void open(url.trim())
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
          <Button type="submit" disabled={loading || !url.trim()}>
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

      {suggestions.length > 0 && (
        <section>
          <SectionLabel>Suggested</SectionLabel>
          <ul className="space-y-1">
            {suggestions.map((s) => (
              <li key={s.url}>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void open(s.url)}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-neutral-700 transition-colors hover:bg-neutral-200 disabled:opacity-50"
                >
                  <BookOpen className="size-4 shrink-0 text-neutral-500" />
                  {s.name}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {remembered.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between">
            <SectionLabel>Previously loaded</SectionLabel>
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-neutral-500 hover:text-red-600"
            >
              Clear all
            </button>
          </div>
          <ul className="space-y-1">
            {remembered.map((b) => (
              <li key={b.url} className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void open(b.url)}
                  className={cn(
                    'w-0 flex-1 rounded-md px-2.5 py-1.5 text-left transition-colors disabled:opacity-50',
                    b.url === active?.url
                      ? 'bg-neutral-900 text-white'
                      : 'text-neutral-700 hover:bg-neutral-200',
                  )}
                  title={describeUrl(b.url)}
                >
                  <span className="block truncate text-sm">{b.name}</span>
                  {b.description && (
                    <span
                      className={cn(
                        'block truncate text-xs',
                        b.url === active?.url ? 'text-neutral-200' : 'text-neutral-600',
                      )}
                    >
                      {b.description}
                    </span>
                  )}
                  <span
                    className={cn(
                      'block truncate text-xs',
                      b.url === active?.url ? 'text-neutral-300' : 'text-neutral-500',
                    )}
                  >
                    {describeUrl(b.url)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => forget(b.url)}
                  className="shrink-0 rounded-md p-1.5 text-neutral-400 transition-colors hover:text-red-600"
                  aria-label={`Forget ${b.name}`}
                  title="Forget this songbook"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

interface SongbookDialogProps extends SongbookPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SongbookDialog({
  open,
  onOpenChange,
  songbooks,
  onLoaded,
  onOpenFile,
}: SongbookDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Songbooks</DialogTitle>
          <DialogDescription>
            A songbook is a JSON file listing Guitar Pro files, or a .sbk file packing them
            into one download.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[65vh] overflow-y-auto pr-1">
          <SongbookPicker
            songbooks={songbooks}
            onOpenFile={onOpenFile}
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
