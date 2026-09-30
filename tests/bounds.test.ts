// Reading alphaTab's bounds lookup into scroll-container coordinates, against
// fake viewports and a fake api, since the bounds are just numbers.

import type * as alphaTab from '@coderline/alphatab'
import { describe, expect, it, vi } from 'vitest'
import { barStarts, computeSystemTops } from '@/score/bounds'

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

  it('takes the surface to start at the top before alphaTab has rendered one', () => {
    expect(computeSystemTops(api([{ y: 300 }, { y: 0 }]), asElement(viewport()))).toEqual([0, 300])
  })
})

describe('barStarts', () => {
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

  it('is empty without an api, a viewport or bounds', () => {
    expect(barStarts(null, asElement(viewport()), false)).toEqual([])
    expect(barStarts(score, null, false)).toEqual([])
    expect(barStarts({} as alphaTab.AlphaTabApi, asElement(viewport()), false)).toEqual([])
  })

  it('uses bar tops, measured from the render surface', () => {
    expect(barStarts(score, asElement(viewport({}, { x: 10, y: 50 })), false)).toEqual([
      { index: 0, start: 50 },
      { index: 1, start: 50 },
      { index: 2, start: 450 },
      { index: 3, start: 450 },
    ])
  })

  it('uses left edges in Horizontal layout', () => {
    expect(barStarts(score, asElement(viewport({}, { x: 10, y: 50 })), true)).toEqual([
      { index: 0, start: 10 },
      { index: 1, start: 310 },
      { index: 2, start: 610 },
      { index: 3, start: 910 },
    ])
  })
})
