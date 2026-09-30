// Tracks as the track picker shows them, which of them are rendered, and the
// instruments they play on.

import type * as alphaTab from '@coderline/alphatab'
import { describe, expect, it } from 'vitest'
import { applyPrograms } from '@/score/programs'
import { NYLON_GUITAR_PROGRAM } from '@/score/settings'
import {
  describeSelection,
  firstOnlyToggled,
  type ScoreTrack,
  toggledIndex,
  toggleTrack,
  toScoreTrack,
  tracksToRender,
} from '@/score/tracks'

interface FakeTrack {
  index: number
  name?: string
  program?: number
  isPercussion?: boolean
  staves?: { isStringed: boolean; tuning: number[]; tuningName?: string }[]
}

const GUITAR_STAFF = { isStringed: true, tuning: [64, 59, 55, 50, 45, 40], tuningName: ' Guitar Standard Tuning ' }

function track({ index, name = 'Guitar', program = 25, isPercussion = false, staves = [GUITAR_STAFF] }: FakeTrack) {
  return { index, name, isPercussion, staves, playbackInfo: { program } } as unknown as alphaTab.model.Track
}

const shown = (count: number): ScoreTrack[] =>
  Array.from({ length: count }, (_, index) => ({ index, name: `T${index}`, summary: '' }))

const set = (...indexes: number[]) => new Set(indexes)

describe('toScoreTrack', () => {
  it('sums up a fretted track by its strings and tuning', () => {
    expect(toScoreTrack(track({ index: 0 }))).toEqual({
      index: 0,
      name: 'Guitar',
      summary: '6-string · Guitar Standard Tuning',
    })
  })

  it('leaves out a blank tuning name', () => {
    const staff = { ...GUITAR_STAFF, tuningName: '  ' }
    expect(toScoreTrack(track({ index: 0, staves: [staff] })).summary).toBe('6-string')
  })

  it('sums up any other track by its MIDI program, and counts its staves', () => {
    const piano = track({ index: 2, name: 'Piano', program: 0, staves: [
      { isStringed: false, tuning: [] },
      { isStringed: false, tuning: [] },
    ] })
    expect(toScoreTrack(piano).summary).toBe('program 0 · 2 staves')
  })

  it('names an unnamed track by its position', () => {
    expect(toScoreTrack(track({ index: 3, name: '  ' })).name).toBe('Track 4')
  })
})

describe('describeSelection', () => {
  it('counts every track as shown when none are picked, or all are', () => {
    expect(describeSelection(shown(3), set())).toEqual({ count: null, label: 'All 3 tracks' })
    expect(describeSelection(shown(3), set(0, 1, 2))).toEqual({ count: null, label: 'All 3 tracks' })
    expect(describeSelection(shown(1), set()).label).toBe('All 1 track')
  })

  it('counts the shown tracks when some are hidden', () => {
    expect(describeSelection(shown(3), set(1))).toEqual({ count: '1/3', label: '1 of 3 tracks' })
  })

  it('says so when there are no tracks', () => {
    expect(describeSelection([], set()).label).toBe('No tracks')
  })
})

describe('toggleTrack', () => {
  it('hides one track out of all of them', () => {
    expect(toggleTrack(shown(3), set(), 1)).toEqual(set(0, 2))
  })

  it('shows a hidden track again, leaving the selection it was given alone', () => {
    const selected = set(0)
    expect(toggleTrack(shown(3), selected, 2)).toEqual(set(0, 2))
    expect(selected).toEqual(set(0))
  })

  it('refuses to hide the last track shown', () => {
    expect(toggleTrack(shown(3), set(1), 1)).toBeNull()
  })
})

describe('toggledIndex', () => {
  it('adds an index that is missing and removes one that is there, in a copy', () => {
    const muted = set(1)
    expect(toggledIndex(muted, 2)).toEqual(set(1, 2))
    expect(toggledIndex(muted, 1)).toEqual(set())
    expect(muted).toEqual(set(1))
  })
})

describe('firstOnlyToggled', () => {
  it('shows only the first track, unless it already is the only one', () => {
    expect(firstOnlyToggled(shown(3), set())).toEqual(set(0))
    expect(firstOnlyToggled(shown(3), set(1, 2))).toEqual(set(0))
    expect(firstOnlyToggled(shown(3), set(0))).toEqual(set())
  })

  it('does nothing without tracks', () => {
    expect(firstOnlyToggled([], set())).toBeNull()
  })
})

describe('tracksToRender', () => {
  const score = { tracks: [track({ index: 0 }), track({ index: 1 }), track({ index: 2 })] } as alphaTab.model.Score

  it('is every track for an empty selection, else the selected ones in score order', () => {
    expect(tracksToRender(score, set())).toBe(score.tracks)
    expect(tracksToRender(score, set(2, 0)).map((t) => t.index)).toEqual([0, 2])
  })
})

describe('applyPrograms', () => {
  const programs = (score: { tracks: alphaTab.model.Track[] }) =>
    score.tracks.map((t) => t.playbackInfo.program)

  it('puts every pitched track on nylon guitar, leaving percussion its kit', () => {
    const score = { tracks: [track({ index: 0, program: 30 }), track({ index: 1, program: 0, isPercussion: true })] }
    applyPrograms(score, true)
    expect(programs(score)).toEqual([NYLON_GUITAR_PROGRAM, 0])
  })

  it("restores each track's own program, and leaves tracks it has none for", () => {
    const score = { tracks: [track({ index: 0, program: 24 }), track({ index: 1, program: 24 })] }
    applyPrograms(score, false, new Map([[0, 30]]))
    expect(programs(score)).toEqual([30, 24])
    applyPrograms(score, false)
    expect(programs(score)).toEqual([30, 24])
  })
})
