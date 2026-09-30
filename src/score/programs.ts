import type * as alphaTab from '@coderline/alphatab'
import { NYLON_GUITAR_PROGRAM } from '@/score/settings'

/**
 * Point every pitched track at nylon guitar, or restore what the file asked for.
 * Percussion is left alone: its "program" is a kit, not an instrument.
 */
export function applyPrograms(
  score: Pick<alphaTab.model.Score, 'tracks'>,
  force: boolean,
  originals?: Map<number, number>,
): void {
  for (const track of score.tracks) {
    if (track.isPercussion) continue
    if (force) {
      track.playbackInfo.program = NYLON_GUITAR_PROGRAM
    } else {
      const original = originals?.get(track.index)
      if (original !== undefined) track.playbackInfo.program = original
    }
  }
}
