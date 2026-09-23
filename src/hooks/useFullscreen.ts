import { type RefObject, useCallback, useEffect, useState } from 'react'

/**
 * Fullscreen for a specific element (the app shell, not document.body) so the
 * sidebar can be hidden while fullscreen.
 *
 * Listens to fullscreenchange so state stays correct when the user leaves via
 * the browser's own Escape or F11 rather than our `f` key.
 */
export function useFullscreen(targetRef: RefObject<HTMLElement | null>) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const sync = () => setIsFullscreen(document.fullscreenElement !== null)
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  const enter = useCallback(async () => {
    const el = targetRef.current
    if (!el || document.fullscreenElement) return
    try {
      await el.requestFullscreen()
    } catch {
      // Denied or unsupported: stay windowed.
    }
  }, [targetRef])

  const exit = useCallback(async () => {
    if (!document.fullscreenElement) return
    try {
      await document.exitFullscreen()
    } catch {
      // Ignore.
    }
  }, [])

  const toggle = useCallback(() => {
    if (document.fullscreenElement) void exit()
    else void enter()
  }, [enter, exit])

  return { isFullscreen, toggle, exit }
}
