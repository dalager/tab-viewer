import { useCallback, useEffect, useState } from 'react'
import { piecePath, pieceUrl } from '@/lib/permalink'
import type { PieceRef } from '@/lib/pieces'

const COPIED_FEEDBACK_MS = 1500

/**
 * Copies a link to a bar of the open piece, and puts it in the address bar
 * too. `link` is null when the piece cannot be linked; `bar` says which
 * (1-based) bar to link to when the copy happens.
 */
export function useCopyLink(link: PieceRef | null, bar: () => number) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS)
    return () => window.clearTimeout(timer)
  }, [copied])

  const copy = useCallback(async () => {
    if (!link) return
    const at = bar()
    window.history.replaceState(null, '', piecePath(link.id, at, link.book))
    try {
      await navigator.clipboard.writeText(pieceUrl(link.id, at, link.book))
      setCopied(true)
    } catch {
      // Clipboard can be refused (permissions, insecure context); the address
      // bar already holds the link, so there is still something to copy.
    }
  }, [link, bar])

  return { copied, copy }
}
