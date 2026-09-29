/**
 * Paging and visibility as plain scroll math. The staff-system tops and bar
 * positions come from score/bounds.ts, which is what knows alphaTab's layout.
 */

/** Fraction of the viewport advanced by a full page, leaving a little overlap. */
export const PAGE_FRACTION = 0.92

/** A master bar (0-based) and where it starts along the scroll axis. */
export interface BarStart {
  index: number
  start: number
}

/** Below this delta the snap target is effectively the current position. */
const DEAD_ZONE_PX = 8

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
  horizontal: boolean,
  fraction = PAGE_FRACTION,
): void {
  // Horizontal layout is a single system: snapping is meaningless.
  if (horizontal) {
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

/** Slack so a bar sitting right at the fold still counts as visible. */
const VISIBLE_TOLERANCE_PX = 4

/**
 * Index of the first master bar that starts at or past `scrollPosition`
 * (scrollTop, or scrollLeft in Horizontal layout). Falls back to 0 without bars.
 */
export function firstVisibleBar(bars: BarStart[], scrollPosition: number): number {
  const fold = scrollPosition - VISIBLE_TOLERANCE_PX
  let first: number | null = null
  for (const bar of bars) {
    if (bar.start >= fold && (first === null || bar.index < first)) first = bar.index
  }
  return first ?? 0
}
