// Paging snaps the fold to staff-system boundaries; these check the scroll
// math against fake viewports, since alphaTab's bounds are just numbers.

import * as alphaTab from '@coderline/alphatab'
import { describe, expect, it, vi } from 'vitest'
import { computeSystemTops, pageBy, topVisibleBar } from '@/score/paging'

const PAGE = alphaTab.LayoutMode.Page
const HORIZONTAL = alphaTab.LayoutMode.Horizontal

interface Viewport {
  scrollTop: number
  scrollLeft: number
  clientHeight: number
  clientWidth: number
  scrollHeight: number
  scrollTo: ReturnType<typeof vi.fn>
  scrollBy: ReturnType<typeof vi.fn>
  querySelector: () => unknown
}

/** A scroll container 1000px tall and wide, whose render surface starts at `surface`. */
function viewport(state: Partial<Viewport> = {}, surface?: { x: number; y: number }) {
  const vp: Viewport = {
    scrollTop: 0,
    scrollLeft: 0,
    clientHeight: 1000,
    clientWidth: 1000,
    scrollHeight: 5000,
    scrollTo: vi.fn(),
    scrollBy: vi.fn(),
    querySelector: () =>
      surface ? { offsetTop: surface.y, offsetLeft: surface.x, offsetParent: vp } : null,
    ...state,
  }
  return vp
}

const asElement = (vp: Viewport) => vp as unknown as HTMLElement

interface Bar {
  index: number
  x: number
  y: number
}

/** An api whose score has one system per entry, each holding the given bars. */
function api(systems: { y: number; bars?: Bar[] }[]) {
  return {
    boundsLookup: {
      staffSystems: systems.map((s) => ({
        realBounds: { x: 0, y: s.y },
        bars: (s.bars ?? []).map((b) => ({ index: b.index, realBounds: { x: b.x, y: b.y } })),
      })),
    },
  } as unknown as alphaTab.AlphaTabApi
}

/** Where pageBy asked the viewport to scroll to. */
const scrolledTo = (vp: Viewport) => vp.scrollTo.mock.calls[0][0].top

describe('computeSystemTops', () => {
  it('is empty without an api, a viewport or rendered systems', () => {
    expect(computeSystemTops(null, asElement(viewport()))).toEqual([])
    expect(computeSystemTops(api([{ y: 0 }]), null)).toEqual([])
    expect(computeSystemTops({} as alphaTab.AlphaTabApi, asElement(viewport()))).toEqual([])
    expect(computeSystemTops(api([]), asElement(viewport()))).toEqual([])
  })

  it('shifts system tops by the surface offset, sorted, dropping non-finite ones', () => {
    const tops = computeSystemTops(
      api([{ y: 600 }, { y: 0 }, { y: Number.NaN }, { y: 300 }]),
      asElement(viewport({}, { x: 0, y: 50 })),
    )
    expect(tops).toEqual([50, 350, 650])
  })
})

describe('pageBy', () => {
  it('scrolls a page sideways in Horizontal layout, ignoring system tops', () => {
    const vp = viewport()
    pageBy(asElement(vp), [0, 400], -1, HORIZONTAL)
    expect(vp.scrollBy).toHaveBeenCalledWith({ left: -920, behavior: 'smooth' })
    expect(vp.scrollTo).not.toHaveBeenCalled()
  })

  it('scrolls a plain page when there are no system tops', () => {
    const vp = viewport()
    pageBy(asElement(vp), [], 1, PAGE)
    expect(scrolledTo(vp)).toBe(920)
  })

  it('snaps forward to the last system that starts above the fold', () => {
    const vp = viewport()
    pageBy(asElement(vp), [0, 400, 800, 1200], 1, PAGE)
    expect(scrolledTo(vp)).toBe(800)
  })

  it('snaps back to the first system that starts below the fold', () => {
    const vp = viewport({ scrollTop: 2000 })
    pageBy(asElement(vp), [0, 400, 800, 1200, 1600], -1, PAGE)
    expect(scrolledTo(vp)).toBe(1200)
  })

  it('scrolls a plain page when the snap would barely move, as in a system taller than a page', () => {
    const vp = viewport({ scrollTop: 800 })
    pageBy(asElement(vp), [0, 805, 2000], 1, PAGE)
    expect(scrolledTo(vp)).toBe(1720)
  })

  it('stays within the scrollable range', () => {
    const atEnd = viewport({ scrollTop: 3900 })
    pageBy(asElement(atEnd), [], 1, PAGE)
    expect(scrolledTo(atEnd)).toBe(4000)

    const atStart = viewport({ scrollTop: 100 })
    pageBy(asElement(atStart), [], -1, PAGE)
    expect(scrolledTo(atStart)).toBe(0)
  })

  it('honours a custom fraction, as half-page scrolling uses', () => {
    const vp = viewport()
    pageBy(asElement(vp), [], 1, PAGE, 0.5)
    expect(scrolledTo(vp)).toBe(500)
  })
})

describe('topVisibleBar', () => {
  const score = api([
    {
      y: 0,
      bars: [
        { index: 0, x: 0, y: 0 },
        { index: 1, x: 300, y: 0 },
      ],
    },
    {
      y: 400,
      bars: [
        { index: 2, x: 600, y: 400 },
        { index: 3, x: 900, y: 400 },
      ],
    },
  ])

  it('is the first bar without an api, a viewport or bounds', () => {
    expect(topVisibleBar(null, asElement(viewport()), PAGE)).toBe(0)
    expect(topVisibleBar(score, null, PAGE)).toBe(0)
    expect(topVisibleBar({} as alphaTab.AlphaTabApi, asElement(viewport()), PAGE)).toBe(0)
  })

  it('is the lowest-numbered bar whose top is at or below the scroll position', () => {
    expect(topVisibleBar(score, asElement(viewport({ scrollTop: 0 })), PAGE)).toBe(0)
    expect(topVisibleBar(score, asElement(viewport({ scrollTop: 200 })), PAGE)).toBe(2)
  })

  it('counts a bar a few pixels above the fold as visible', () => {
    expect(topVisibleBar(score, asElement(viewport({ scrollTop: 403 })), PAGE)).toBe(2)
    expect(topVisibleBar(score, asElement(viewport({ scrollTop: 405 })), PAGE)).toBe(0)
  })

  it('measures from the render surface, not the container', () => {
    const vp = viewport({ scrollTop: 420 }, { x: 0, y: 50 })
    expect(topVisibleBar(score, asElement(vp), PAGE)).toBe(2)
  })

  it('uses left edges in Horizontal layout', () => {
    const vp = viewport({ scrollTop: 9999, scrollLeft: 500 })
    expect(topVisibleBar(score, asElement(vp), HORIZONTAL)).toBe(2)
  })
})
