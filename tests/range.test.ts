// Playback ranges come from alphaTab in ticks; the toolbar shows them as bars.

import type * as alphaTab from '@coderline/alphatab'
import { describe, expect, it } from 'vitest'
import { barAt, barRangeOf, barStartTicks } from '@/score/range'

// Three 4/4 bars at alphaTab's 960 ticks per quarter note.
const STARTS = [0, 3840, 7680]

describe('barAt', () => {
  it('is the bar whose start is the last at or before the tick', () => {
    expect(barAt(STARTS, 0)).toBe(0)
    expect(barAt(STARTS, 3839)).toBe(0)
    expect(barAt(STARTS, 3840)).toBe(1)
    expect(barAt(STARTS, 99_999)).toBe(2)
  })

  it('is the first bar without any bars', () => {
    expect(barAt([], 500)).toBe(0)
  })
})

describe('barRangeOf', () => {
  it('names the first and last bar a tick range touches', () => {
    expect(barRangeOf(STARTS, { startTick: 0, endTick: 7000 })).toEqual({ first: 0, last: 1 })
    expect(barRangeOf(STARTS, { startTick: 3840, endTick: 3900 })).toEqual({ first: 1, last: 1 })
  })

  it('is null without a range', () => {
    expect(barRangeOf(STARTS, null)).toBeNull()
  })
})

describe('barStartTicks', () => {
  const masterBars = [{ start: 0 }, { start: 3840 }] as alphaTab.model.MasterBar[]

  it("reads each bar's start from the tick cache when there is one", () => {
    const tickCache = { getMasterBarStart: (bar: { start: number }) => bar.start + 1 }
    const api = { score: { masterBars }, tickCache } as unknown as alphaTab.AlphaTabApi
    expect(barStartTicks(api)).toEqual([1, 3841])
  })

  it("falls back to the bars' own starts, and to no bars without a score", () => {
    expect(barStartTicks({ score: { masterBars }, tickCache: null } as unknown as alphaTab.AlphaTabApi)).toEqual([0, 3840])
    expect(barStartTicks({ score: null, tickCache: null } as unknown as alphaTab.AlphaTabApi)).toEqual([])
  })
})
