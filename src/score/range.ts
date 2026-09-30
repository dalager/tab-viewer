/**
 * Playback ranges, which alphaTab keeps in ticks, as the bars a reader sees.
 * Pure math over each bar's start tick, read from the score by barStartTicks.
 */

import type * as alphaTab from '@coderline/alphatab'

/** Bars (0-based, both ends included) a selection covers. */
export interface BarRange {
  first: number
  last: number
}

/** Index of the bar containing `tick`, given every bar's start tick in order. */
export function barAt(starts: number[], tick: number): number {
  let bar = 0
  for (let i = 0; i < starts.length && starts[i] <= tick; i++) bar = i
  return bar
}

/** The bars a tick range covers, or null for no range. */
export function barRangeOf(
  starts: number[],
  range: { startTick: number; endTick: number } | null,
): BarRange | null {
  if (!range) return null
  return { first: barAt(starts, range.startTick), last: barAt(starts, range.endTick) }
}

/** Where each master bar starts in playback ticks, in order; none without a score. */
export function barStartTicks(api: Pick<alphaTab.AlphaTabApi, 'score' | 'tickCache'>): number[] {
  const bars = api.score?.masterBars ?? []
  const ticks = api.tickCache
  return bars.map((bar) => (ticks ? ticks.getMasterBarStart(bar) : bar.start))
}
