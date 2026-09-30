import type * as alphaTab from '@coderline/alphatab'
import { useCallback, useEffect, useRef, useState } from 'react'
import { applyPrograms } from '@/score/programs'
import { MAX_SPEED, MIN_SPEED } from '@/score/settings'

export interface PlayerSettings {
  metronome: boolean
  toggleMetronome: () => void
  /** Playback speed, 1.0 being the written tempo. */
  speed: number
  setSpeed: (value: number) => void
  /** Adjust relative to the current speed, immune to stale closures. */
  nudgeSpeed: (delta: number) => void
  /** Play every non-percussion track on nylon guitar, ignoring the file's own instruments. */
  guitarOnly: boolean
  toggleGuitarOnly: () => void
}

/**
 * Rebuilds the MIDI after a program change. alphaTab drops the playback range
 * when it does, so a selection would go on showing but stop limiting
 * playback; put it back.
 */
function reloadMidi(instance: alphaTab.AlphaTabApi): void {
  const range = instance.playbackRange
  instance.loadMidiForScore()
  if (range) instance.playbackRange = range
}

function applySpeed(instance: alphaTab.AlphaTabApi, speed: number): void {
  instance.playbackSpeed = speed
}

function applyMetronome(instance: alphaTab.AlphaTabApi, on: boolean): void {
  instance.metronomeVolume = on ? 1 : 0
}

/** Rounded to whole percent so repeated steps do not drift. */
function clampSpeed(value: number): number {
  return Math.round(Math.min(MAX_SPEED, Math.max(MIN_SPEED, value)) * 100) / 100
}

/**
 * How the player sounds: speed, the nylon guitar override and the metronome.
 * A practice tempo should survive switching pieces, so it is re-applied on
 * every load rather than reset. Same for the instrument override.
 */
export function usePlayerSettings(api: alphaTab.AlphaTabApi | null): PlayerSettings {
  const [metronome, setMetronome] = useState(false)
  const [speed, setSpeedState] = useState(1)
  const [guitarOnly, setGuitarOnly] = useState(false)

  // Read by the scoreLoaded handler, which must not be re-subscribed on change.
  const speedRef = useRef(1)
  const guitarOnlyRef = useRef(false)
  /** The programs the file itself asked for, so the override can be undone. */
  const originalPrograms = useRef(new Map<number, number>())

  useEffect(() => {
    if (!api) return
    const onScoreLoaded = (score: alphaTab.model.Score) => {
      applySpeed(api, speedRef.current)
      // Remember what this file asked for before any override touches it.
      originalPrograms.current = new Map(score.tracks.map((t) => [t.index, t.playbackInfo.program]))
      if (!guitarOnlyRef.current) return
      applyPrograms(score, true)
      api.loadMidiForScore()
    }
    api.scoreLoaded.on(onScoreLoaded)
    return () => api.scoreLoaded.off(onScoreLoaded)
  }, [api])

  const setSpeed = useCallback(
    (value: number) => {
      const next = clampSpeed(value)
      speedRef.current = next
      setSpeedState(next)
      if (api) applySpeed(api, next)
    },
    [api],
  )

  // Reads the ref rather than state so repeated presses inside one React batch
  // each apply, instead of all computing from the same stale value.
  const nudgeSpeed = useCallback((delta: number) => setSpeed(speedRef.current + delta), [setSpeed])

  const toggleGuitarOnly = useCallback(() => {
    const score = api?.score
    if (!api || !score) return
    const next = !guitarOnlyRef.current
    guitarOnlyRef.current = next
    setGuitarOnly(next)
    applyPrograms(score, next, originalPrograms.current)
    // Program changes live in the generated MIDI, so it has to be rebuilt.
    // This stops playback, which is why it is not bound to a hold-to-repeat key.
    reloadMidi(api)
  }, [api])

  const toggleMetronome = useCallback(() => {
    if (!api) return
    applyMetronome(api, !metronome)
    setMetronome(!metronome)
  }, [api, metronome])

  return { metronome, toggleMetronome, speed, setSpeed, nudgeSpeed, guitarOnly, toggleGuitarOnly }
}
