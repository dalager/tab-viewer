import { SongbookPicker } from '@/components/SongbookDialog'
import type { UseSongbooks } from '@/hooks/useSongbooks'
import type { Songbook } from '@/lib/songbook'

interface EmptyLibraryProps {
  songbooks: UseSongbooks
  onLoaded: (book: Songbook) => void
  onOpenFile: () => void
}

/** Covers the score when there is nothing to read: no songbook and no imports. */
export function EmptyLibrary({ songbooks, onLoaded, onOpenFile }: EmptyLibraryProps) {
  return (
    <div className="absolute inset-0 z-20 flex items-start justify-center overflow-y-auto bg-white p-6 sm:pt-16">
      <div className="w-full max-w-lg">
        <h2 className="text-lg font-semibold text-neutral-900">Load a songbook</h2>
        <p className="mt-1 mb-6 text-sm text-neutral-500">
          Paste the URL of a songbook, pick one below, or drop a .sbk songbook or Guitar Pro
          files anywhere.
        </p>
        <SongbookPicker songbooks={songbooks} onLoaded={onLoaded} onOpenFile={onOpenFile} />
      </div>
    </div>
  )
}
