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
