// Paging snaps the fold to staff-system boundaries; these check the scroll
// math against fake viewports. The boundaries themselves are plain numbers.

import { describe, expect, it, vi } from 'vitest'
import { firstVisibleBar, pageBy, scrollToEdge } from '@/score/paging'

interface Viewport {
  scrollTop: number
  scrollLeft: number
  clientHeight: number
  clientWidth: number
  scrollHeight: number
  scrollWidth: number
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
    scrollWidth: 8000,
    scrollTo: vi.fn(),
    scrollBy: vi.fn(),
    querySelector: () =>
      surface ? { offsetTop: surface.y, offsetLeft: surface.x, offsetParent: vp } : null,
    ...state,
  }
  return vp
}

const asElement = (vp: Viewport) => vp as unknown as HTMLElement

/** Where pageBy asked the viewport to scroll to. */
const scrolledTo = (vp: Viewport) => vp.scrollTo.mock.calls[0][0].top

describe('pageBy', () => {
  it('scrolls a page sideways in Horizontal layout, ignoring system tops', () => {
    const vp = viewport()
    pageBy(asElement(vp), [0, 400], -1, true)
    expect(vp.scrollBy).toHaveBeenCalledWith({ left: -920, behavior: 'smooth' })
    expect(vp.scrollTo).not.toHaveBeenCalled()
  })

  it('scrolls a plain page when there are no system tops', () => {
    const vp = viewport()
    pageBy(asElement(vp), [], 1, false)
    expect(scrolledTo(vp)).toBe(920)
  })

  it('snaps forward to the last system that starts above the fold', () => {
    const vp = viewport()
    pageBy(asElement(vp), [0, 400, 800, 1200], 1, false)
    expect(scrolledTo(vp)).toBe(800)
  })

  it('snaps back to the first system that starts below the fold', () => {
    const vp = viewport({ scrollTop: 2000 })
    pageBy(asElement(vp), [0, 400, 800, 1200, 1600], -1, false)
    expect(scrolledTo(vp)).toBe(1200)
  })

  it('scrolls a plain page when the snap would barely move, as in a system taller than a page', () => {
    const vp = viewport({ scrollTop: 800 })
    pageBy(asElement(vp), [0, 805, 2000], 1, false)
    expect(scrolledTo(vp)).toBe(1720)
  })

  it('stays within the scrollable range', () => {
    const atEnd = viewport({ scrollTop: 3900 })
    pageBy(asElement(atEnd), [], 1, false)
    expect(scrolledTo(atEnd)).toBe(4000)

    const atStart = viewport({ scrollTop: 100 })
    pageBy(asElement(atStart), [], -1, false)
    expect(scrolledTo(atStart)).toBe(0)
  })

  it('honours a custom fraction, as half-page scrolling uses', () => {
    const vp = viewport()
    pageBy(asElement(vp), [], 1, false, 0.5)
    expect(scrolledTo(vp)).toBe(500)
  })
})

describe('firstVisibleBar', () => {
  const bars = [
    { index: 0, start: 0 },
    { index: 1, start: 0 },
    { index: 2, start: 400 },
    { index: 3, start: 400 },
  ]

  it('is the first bar when there are no bars', () => {
    expect(firstVisibleBar([], 500)).toBe(0)
  })

  it('is the lowest-numbered bar that starts at or past the scroll position', () => {
    expect(firstVisibleBar(bars, 0)).toBe(0)
    expect(firstVisibleBar(bars, 200)).toBe(2)
  })

  it('counts a bar a few pixels above the fold as visible', () => {
    expect(firstVisibleBar(bars, 403)).toBe(2)
    expect(firstVisibleBar(bars, 405)).toBe(0)
  })
})

describe('scrollToEdge', () => {
  it('scrolls to the top for the start', () => {
    const vp = viewport({ scrollTop: 2000 })
    scrollToEdge(asElement(vp), 'start')
    expect(scrolledTo(vp)).toBe(0)
  })

  it('scrolls as far as the content goes for the end, and nowhere when it all fits', () => {
    const vp = viewport()
    scrollToEdge(asElement(vp), 'end')
    expect(scrolledTo(vp)).toBe(4000)
    const short = viewport({ scrollHeight: 600 })
    scrollToEdge(asElement(short), 'end')
    expect(scrolledTo(short)).toBe(0)
  })

  it('scrolls sideways in the horizontal layout', () => {
    const vp = viewport({ scrollTop: 300, scrollLeft: 2000 })
    scrollToEdge(asElement(vp), 'end', true)
    expect(vp.scrollTo).toHaveBeenCalledWith({ left: 7000, behavior: 'smooth' })
    scrollToEdge(asElement(vp), 'start', true)
    expect(vp.scrollTo).toHaveBeenLastCalledWith({ left: 0, behavior: 'smooth' })
  })
})
