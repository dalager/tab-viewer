// Which shortcut a key press triggers, against the app's real shortcut table:
// modifiers, text fields and open overlays each hold some shortcuts back.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { matchShortcut } from '@/hooks/useHotkeys'
import { SHORTCUTS } from '@/shortcuts'

/** Tests run without a DOM; this stands in for the elements focus can be on. */
class FakeElement {
  tagName: string
  isContentEditable: boolean
  constructor(tagName: string, isContentEditable = false) {
    this.tagName = tagName
    this.isContentEditable = isContentEditable
  }
}

beforeEach(() => vi.stubGlobal('HTMLElement', FakeElement))
afterEach(() => vi.unstubAllGlobals())

interface Press {
  target?: unknown
  ctrlKey?: boolean
  metaKey?: boolean
  altKey?: boolean
  overlayOpen?: boolean
}

/** The action a key press runs, or undefined when it is left to the browser. */
function actionFor(key: string, press: Press = {}) {
  const event = {
    key,
    target: (press.target ?? new FakeElement('BODY')) as EventTarget,
    ctrlKey: press.ctrlKey ?? false,
    metaKey: press.metaKey ?? false,
    altKey: press.altKey ?? false,
  }
  return matchShortcut(SHORTCUTS, event, press.overlayOpen ?? false)?.action
}

describe('matchShortcut', () => {
  it('runs the action bound to a key, and nothing for an unbound one', () => {
    expect(actionFor('j')).toBe('halfPageDown')
    expect(actionFor(']')).toBe('nextPiece')
    expect(actionFor('x')).toBeUndefined()
  })

  it('leaves Ctrl, Cmd and Alt combinations to the browser', () => {
    expect(actionFor('f', { ctrlKey: true })).toBeUndefined()
    expect(actionFor('c', { metaKey: true })).toBeUndefined()
    expect(actionFor('l', { altKey: true })).toBeUndefined()
  })

  it('tells k apart from Ctrl+K and Cmd+K', () => {
    expect(actionFor('k')).toBe('halfPageUp')
    expect(actionFor('k', { ctrlKey: true })).toBe('openPalette')
    expect(actionFor('k', { metaKey: true })).toBe('openPalette')
  })

  it('holds everything but Escape and ? back while an overlay is open', () => {
    const overlayOpen = true
    expect(actionFor('j', { overlayOpen })).toBeUndefined()
    expect(actionFor('k', { ctrlKey: true, overlayOpen })).toBeUndefined()
    expect(actionFor('Escape', { overlayOpen })).toBe('escape')
    expect(actionFor('?', { overlayOpen })).toBe('toggleHelp')
  })

  it.each([
    ['an input', new FakeElement('INPUT')],
    ['a textarea', new FakeElement('TEXTAREA')],
    ['a select', new FakeElement('SELECT')],
    ['an editable element', new FakeElement('DIV', true)],
  ])('lets typing in %s through, ? included, but not Escape or Ctrl+K', (_, target) => {
    expect(actionFor('j', { target })).toBeUndefined()
    expect(actionFor(' ', { target })).toBeUndefined()
    expect(actionFor('?', { target })).toBeUndefined()
    expect(actionFor('?', { target, overlayOpen: true })).toBeUndefined()
    expect(actionFor('Escape', { target })).toBe('escape')
    expect(actionFor('k', { target, ctrlKey: true })).toBe('openPalette')
  })

  it('treats a key press aimed at no element as not typing', () => {
    expect(actionFor('j', { target: {} })).toBe('halfPageDown')
  })
})
