/**
 * Packs pieces into a new .sbk: a songbook.json listing them plus each file
 * under tabs/, the same layout scripts/build-manifest.mjs produces.
 */

import { packSongbook } from '@/lib/sbk'
import { idAllocator, slugify } from '@/lib/songbook'
import { errorMessage, fetchBytes } from '@/lib/utils'
import type { TabEntry } from '@/types'

interface ExportRequest {
  name: string
  description: string
  tabs: TabEntry[]
  /** Compress for a download; skip it for a copy kept in this browser. */
  compress: boolean
}

export async function exportSongbook({
  name,
  description,
  tabs,
  compress,
}: ExportRequest): Promise<File> {
  const title = name.trim()
  if (!title) throw new Error('give the songbook a name')
  if (tabs.length === 0) throw new Error('select at least one piece')

  // Every piece's file is a URL (blob: for imports and .sbk pieces), so one fetch covers all.
  const bytes = await Promise.all(
    tabs.map((tab) =>
      fetchBytes(tab.file).catch((e: unknown) => {
        throw new Error(`"${tab.title}" could not be read (${errorMessage(e)})`)
      }),
    ),
  )

  // Fresh ids from the titles: imports carry opaque "imported-<uuid>" ones.
  const uniqueId = idAllocator()
  const files: Record<string, Uint8Array> = {}
  const songs = tabs.map((tab, i) => {
    const id = uniqueId(slugify(tab.title) || `song-${i + 1}`)
    const url = `tabs/${id}.${tab.ext}`
    files[url] = bytes[i]
    return { id, title: tab.title, ...(tab.artist && { artist: tab.artist }), url }
  })

  const manifest = {
    songbook: 1,
    name: title,
    ...(description.trim() && { description: description.trim() }),
    songs,
  }
  const zip = packSongbook(manifest, files, compress ? 6 : 0)
  return new File([zip as Uint8Array<ArrayBuffer>], `${slugify(title) || 'songbook'}.sbk`, {
    type: 'application/zip',
  })
}

/** Hands the file to the browser as a download. */
export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  link.click()
  // Revoking straight away can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
