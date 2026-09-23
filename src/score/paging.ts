import * as alphaTab from '@coderline/alphatab'

/** Fraction of the viewport advanced by a full page, leaving a little overlap. */
export const PAGE_FRACTION = 0.92

/** Below this delta the snap target is effectively the current position. */
const DEAD_ZONE_PX = 8

/** Vertical offset of `el` within the scrolling `container`. */
function offsetWithin(el: HTMLElement, container: HTMLElement): number {
  let y = 0
  let node: HTMLElement | null = el
  while (node && node !== container) {
    y += node.offsetTop
    node = node.offsetParent as HTMLElement | null
  }
  return y
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
  const surface = viewport.querySelector<HTMLElement>('.at-surface')
  const surfaceTop = surface ? offsetWithin(surface, viewport) : 0

  return systems
    .map((s) => surfaceTop + s.realBounds.y)
    .filter((y) => Number.isFinite(y))
    .sort((a, b) => a - b)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Advance one page, snapping the fold to a staff-system boundary so no system
 * is sliced in half. Falls back to plain proportional scrolling whenever bounds
 * are unavailable or the snap would not move.
 */
export function pageBy(
  viewport: HTMLElement,
  tops: number[],
  direction: 1 | -1,
  layoutMode: alphaTab.LayoutMode,
  fraction = PAGE_FRACTION,
): void {
  // Horizontal layout is a single system: snapping is meaningless.
  if (layoutMode === alphaTab.LayoutMode.Horizontal) {
    viewport.scrollBy({ left: direction * viewport.clientWidth * fraction, behavior: 'smooth' })
    return
  }

  const maxScroll = Math.max(0, viewport.scrollHeight - viewport.clientHeight)
  const naive = viewport.scrollTop + direction * viewport.clientHeight * fraction

  let target = naive

  if (tops.length > 0) {
    const candidate =
      direction === 1
        ? // last boundary at or above the naive fold
          tops.reduce<number | null>((best, y) => (y <= naive ? y : best), null)
        : // first boundary at or below it
          tops.reduce<number | null>((best, y) => (best === null && y >= naive ? y : best), null)

    if (candidate !== null && Math.abs(candidate - viewport.scrollTop) >= DEAD_ZONE_PX) {
      target = candidate
    }
  }

  viewport.scrollTo({ top: clamp(target, 0, maxScroll), behavior: 'smooth' })
}

export function scrollToEdge(viewport: HTMLElement, edge: 'start' | 'end'): void {
  viewport.scrollTo({
    top: edge === 'start' ? 0 : Math.max(0, viewport.scrollHeight - viewport.clientHeight),
    behavior: 'smooth',
  })
}
