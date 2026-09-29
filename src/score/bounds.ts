/**
 * Reads where alphaTab put things on screen: staff-system tops and bar starts,
 * in the scroll container's coordinate space, for the math in paging.ts.
 *
 * This and the score hooks are the only places that know alphaTab's bounds
 * lookup and the `.at-surface` element it renders into.
 */

import type * as alphaTab from '@coderline/alphatab'
import type { BarStart } from '@/score/paging'

/** Offset of `el` within the scrolling `container`, along one axis. */
function offsetWithin(el: HTMLElement, container: HTMLElement, axis: 'x' | 'y' = 'y'): number {
  let offset = 0
  let node: HTMLElement | null = el
  while (node && node !== container) {
    offset += axis === 'y' ? node.offsetTop : node.offsetLeft
    node = node.offsetParent as HTMLElement | null
  }
  return offset
}

/** Origin of alphaTab's render surface in the scroll container's coordinate space. */
function surfaceOrigin(viewport: HTMLElement): { x: number; y: number } {
  const surface = viewport.querySelector<HTMLElement>('.at-surface')
  if (!surface) return { x: 0, y: 0 }
  return { x: offsetWithin(surface, viewport, 'x'), y: offsetWithin(surface, viewport, 'y') }
}

/**
 * Top offset of each staff system, in the scroll container's coordinate space.
 *
 * alphaTab has no page concept in Page layout ("vertically endless"), so paging
 * is scroll math over these boundaries rather than an API call.
 *
 * realBounds is used rather than visualBounds so the whitespace between systems
 * belongs to the page being left behind.
 */
export function computeSystemTops(
  api: alphaTab.AlphaTabApi | null,
  viewport: HTMLElement | null,
): number[] {
  if (!api || !viewport) return []

  const systems = api.boundsLookup?.staffSystems
  if (!systems || systems.length === 0) return []

  // realBounds.y is relative to the render surface, not the scroll container.
  const surfaceTop = surfaceOrigin(viewport).y

  return systems
    .map((s) => surfaceTop + s.realBounds.y)
    .filter((y) => Number.isFinite(y))
    .sort((a, b) => a - b)
}

/** Where each master bar starts: its top, or its left edge in Horizontal layout. */
export function barStarts(
  api: alphaTab.AlphaTabApi | null,
  viewport: HTMLElement | null,
  horizontal: boolean,
): BarStart[] {
  const systems = api?.boundsLookup?.staffSystems
  if (!viewport || !systems) return []

  const origin = surfaceOrigin(viewport)
  return systems.flatMap((system) =>
    system.bars.map((bar) => ({
      index: bar.index,
      start: horizontal ? origin.x + bar.realBounds.x : origin.y + bar.realBounds.y,
    })),
  )
}
