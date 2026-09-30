import { useCallback, useState } from 'react'
import { useMediaQuery } from '@/hooks/useMediaQuery'

/** Tailwind's `md`: from here up the list sits beside the score. */
const WIDE = '(min-width: 768px)'

/**
 * The piece list. On a wide screen it sits beside the score and starts open;
 * on a phone it covers the score, so it starts closed and closes once a piece
 * is picked from it.
 */
export function useSidebar() {
  const wide = useMediaQuery(WIDE)
  const [open, setOpen] = useState(() => window.matchMedia(WIDE).matches)

  const toggle = useCallback(() => setOpen((v) => !v), [])
  const close = useCallback(() => setOpen(false), [])
  const picked = useCallback(() => {
    if (!wide) setOpen(false)
  }, [wide])

  return { open, overlay: !wide, toggle, close, picked }
}
