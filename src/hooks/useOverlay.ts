import { useCallback, useState } from 'react'

export type Overlay = 'palette' | 'help' | 'songbooks' | 'export'

/** Which dialog is open; at most one is at a time, and Escape closes it. */
export function useOverlay() {
  const [overlay, setOverlay] = useState<Overlay | null>(null)

  /** A handler that opens this dialog, for buttons and shortcuts. */
  const opener = useCallback((which: Overlay) => () => setOverlay(which), [])
  const toggle = useCallback(
    (which: Overlay) => setOverlay((open) => (open === which ? null : which)),
    [],
  )
  const close = useCallback(() => setOverlay(null), [])

  /** The open/onOpenChange pair a dialog component takes. */
  const dialogProps = (which: Overlay) => ({
    open: overlay === which,
    onOpenChange: (open: boolean) => setOverlay(open ? which : null),
  })

  return { isOpen: overlay !== null, opener, toggle, close, dialogProps }
}
