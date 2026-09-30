import type * as alphaTab from '@coderline/alphatab'

/** A track of the open score, as the track picker shows it. */
export interface ScoreTrack {
  index: number
  name: string
  /** Short summary line: tuning for fretted staves, MIDI program otherwise. */
  summary: string
}

function summarize(track: alphaTab.model.Track): string {
  const staff = track.staves[0]
  const parts: string[] = []

  if (staff?.isStringed && staff.tuning.length > 0) {
    parts.push(`${staff.tuning.length}-string`)
    const name = staff.tuningName?.trim()
    if (name) parts.push(name)
  } else {
    parts.push(`program ${track.playbackInfo.program}`)
  }

  if (track.staves.length > 1) parts.push(`${track.staves.length} staves`)
  return parts.join(' · ')
}

export function toScoreTrack(track: alphaTab.model.Track): ScoreTrack {
  return {
    index: track.index,
    name: track.name?.trim() || `Track ${track.index + 1}`,
    summary: summarize(track),
  }
}

/** How many tracks are shown, and the label saying so; `selected` empty means all. */
export function describeSelection(tracks: ScoreTrack[], selected: Set<number>) {
  const isAll = selected.size === 0 || selected.size === tracks.length
  const activeCount = selected.size === 0 ? tracks.length : selected.size
  const plural = tracks.length === 1 ? '' : 's'
  const label =
    tracks.length === 0
      ? 'No tracks'
      : isAll
        ? `All ${tracks.length} track${plural}`
        : `${activeCount} of ${tracks.length} tracks`
  // The count shows only when some tracks are hidden, like speed off 100%.
  const count = isAll ? null : `${activeCount}/${tracks.length}`
  return { count, label }
}

/** A copy of the set with `index` added, or removed if it was there. */
export function toggledIndex(indexes: Set<number>, index: number): Set<number> {
  const next = new Set(indexes)
  if (next.has(index)) next.delete(index)
  else next.add(index)
  return next
}

/** The selection with one track flipped, or null if that would hide every track. */
export function toggleTrack(
  tracks: ScoreTrack[],
  selected: Set<number>,
  index: number,
): Set<number> | null {
  // An empty set means "all", so materialise it before removing anything.
  const all = selected.size === 0 ? new Set(tracks.map((t) => t.index)) : selected
  const next = toggledIndex(all, index)
  return next.size === 0 ? null : next
}

/** Every track if only the first is shown, else only the first; null without tracks. */
export function firstOnlyToggled(tracks: ScoreTrack[], selected: Set<number>): Set<number> | null {
  if (tracks.length === 0) return null
  const first = tracks[0].index
  const firstOnly = selected.size === 1 && selected.has(first)
  return firstOnly ? new Set() : new Set([first])
}

/** The tracks alphaTab should render, `indexes` empty meaning all of them. */
export function tracksToRender(
  score: alphaTab.model.Score,
  indexes: Set<number>,
): alphaTab.model.Track[] {
  return indexes.size === 0 ? score.tracks : score.tracks.filter((t) => indexes.has(t.index))
}
