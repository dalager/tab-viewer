import { useEffect, useRef } from 'react'

export interface Shortcut<A extends string = string> {
  /** event.key values that trigger this shortcut. */
  keys: string[]
  /** Shown in the help overlay. */
  label: string
  description: string
  group: string
  /** Requires Ctrl/Cmd (the sole exception to the modifier guard). */
  withCtrl?: boolean
  /** Still fires while a dialog is open (Escape and ?). */
  allowInOverlay?: boolean
  /** Name of the action to run; the caller supplies the implementations. */
  action: A
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable
}

/**
 * The shortcut a key press triggers, or undefined when none applies: typing in
 * a field and holding Ctrl/Cmd/Alt suppress shortcuts that do not opt in.
 */
export function matchShortcut<A extends string>(
  shortcuts: readonly Shortcut<A>[],
  event: Pick<KeyboardEvent, 'key' | 'target' | 'ctrlKey' | 'metaKey' | 'altKey'>,
  overlayOpen: boolean,
): Shortcut<A> | undefined {
  const typing = isTypingTarget(event.target)
  const modified = event.ctrlKey || event.metaKey || event.altKey

  return shortcuts.find((shortcut) => {
    if (!shortcut.keys.includes(event.key)) return false
    if (shortcut.withCtrl && !(event.ctrlKey || event.metaKey)) return false
    if (!shortcut.withCtrl && modified) return false
    if (overlayOpen && !shortcut.allowInOverlay) return false
    // Only Escape leaves a field: ? works in overlays but must still type a ?.
    if (typing && !shortcut.withCtrl && event.key !== 'Escape') return false
    return true
  })
}

/**
 * One window keydown listener for the whole app.
 *
 * Suppressed inside text inputs and when Ctrl/Cmd/Alt is held, except for
 * shortcuts that explicitly opt in. Handled keys get preventDefault() so
 * PageDown does not also scroll natively.
 */
export function useHotkeys<A extends string>(
  shortcuts: readonly Shortcut<A>[],
  actions: Record<A, () => void>,
  overlayOpen: boolean,
): void {
  // Read when a key is pressed, so the listener never has to be re-attached
  // just because an action closed over newer state.
  const latest = useRef({ actions, overlayOpen })
  useEffect(() => {
    latest.current = { actions, overlayOpen }
  })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const { actions, overlayOpen } = latest.current
      const shortcut = matchShortcut(shortcuts, event, overlayOpen)
      if (!shortcut) return

      event.preventDefault()
      actions[shortcut.action]()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [shortcuts])
}
