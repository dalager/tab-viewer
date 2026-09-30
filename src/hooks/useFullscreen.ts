import { useCallback, useEffect, useState } from 'react'

/**
 * Full screen for the whole page. Not just the app shell: dialogs and popovers
 * are portalled to <body>, outside the shell, and would be hidden behind it.
 *
 * Listens to fullscreenchange so state stays correct when the user leaves via
 * the browser's own Escape or F11 rather than our `f` key.
 */
export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const sync = () => setIsFullscreen(document.fullscreenElement !== null)
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  const enter = useCallback(async () => {
    if (document.fullscreenElement) return
    try {
      await document.documentElement.requestFullscreen()
    } catch {
      // Denied or unsupported: stay windowed.
    }
  }, [])

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

  // False on iPhone, where only video can go full screen.
  return { isFullscreen, supported: document.fullscreenEnabled === true, toggle, exit }
}
