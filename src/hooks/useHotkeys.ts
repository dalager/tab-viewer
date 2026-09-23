import { useEffect } from 'react'

export interface Shortcut {
  /** event.key values that trigger this shortcut. */
  keys: string[]
  /** Shown in the help overlay. */
  label: string
  description: string
  group: string
  /** Requires Ctrl/Cmd (the sole exception to the modifier guard). */
  withCtrl?: boolean
  /** Still fires while a dialog is open (Escape only). */
  allowInOverlay?: boolean
  run: (event: KeyboardEvent) => void
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable
}

/**
 * One window keydown listener for the whole app.
 *
 * Suppressed inside text inputs and when Ctrl/Cmd/Alt is held, except for
 * shortcuts that explicitly opt in. Handled keys get preventDefault() so
 * PageDown does not also scroll natively.
 */
export function useHotkeys(shortcuts: Shortcut[], overlayOpen: boolean): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const typing = isTypingTarget(event.target)
      const modified = event.ctrlKey || event.metaKey || event.altKey

      for (const shortcut of shortcuts) {
        if (!shortcut.keys.includes(event.key)) continue
        if (shortcut.withCtrl && !(event.ctrlKey || event.metaKey)) continue
        if (!shortcut.withCtrl && modified) continue
        if (overlayOpen && !shortcut.allowInOverlay) continue
        if (typing && !shortcut.allowInOverlay && !shortcut.withCtrl) continue

        event.preventDefault()
        shortcut.run(event)
        return
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [shortcuts, overlayOpen])
}
