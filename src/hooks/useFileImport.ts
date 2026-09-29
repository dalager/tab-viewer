import { useCallback, useRef } from 'react'
import { IMPORTED_BOOK, type PieceTarget } from '@/lib/pieces'
import type { Songbook } from '@/lib/songbook'

const isSongbookFile = (file: File) => file.name.toLowerCase().endsWith('.sbk')

interface FileImportOptions {
  /** Stores Guitar Pro files; resolves to the ids added. */
  importFiles: (files: File[]) => Promise<string[]>
  /** Stores a .sbk and loads it; resolves to the book, or null on failure. */
  openBookFile: (file: File) => Promise<Songbook | null>
  /** Called with a book opened from a file, once it has loaded. */
  onBookOpened: (book: Songbook) => void
  /** Opens a piece, here an imported one. */
  select: (piece: PieceTarget) => void
}

/**
 * Files brought in from disk, through the file picker or a drop: Guitar Pro
 * files are imported, and a .sbk is opened as the songbook.
 */
export function useFileImport({ importFiles, openBookFile, onBookOpened, select }: FileImportOptions) {
  const inputRef = useRef<HTMLInputElement>(null)

  /** Stores a .sbk in this browser and switches to it; resolves true if it opened. */
  const openBook = useCallback(
    async (file: File) => {
      const opened = await openBookFile(file)
      if (opened) onBookOpened(opened)
      return opened !== null
    },
    [openBookFile, onBookOpened],
  )

  // Importing selects the last file added, so it shows up straight away. A
  // .sbk among them is opened as the songbook instead (the last one wins).
  const importAll = useCallback(
    async (files: File[]) => {
      const bookFile = files.filter(isSongbookFile).at(-1)
      const pieces = files.filter((f) => !isSongbookFile(f))
      const ids = pieces.length > 0 ? await importFiles(pieces) : []
      const opened = bookFile !== undefined && (await openBook(bookFile))
      const last = ids.at(-1)
      if (!opened && last) select({ book: IMPORTED_BOOK, id: last })
    },
    [importFiles, openBook, select],
  )

  const pickFiles = useCallback(() => inputRef.current?.click(), [])

  return { inputRef, openBook, importAll, pickFiles }
}
