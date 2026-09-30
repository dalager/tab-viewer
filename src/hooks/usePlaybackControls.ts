import type * as alphaTab from '@coderline/alphatab'
import { useCallback, useEffect, useState } from 'react'
import { type BarRange, barRangeOf, barStartTicks } from '@/score/range'
import { toggledIndex } from '@/score/tracks'

export interface PlaybackControls {
  /** Indexes of the tracks that are silent, so the reader can play them instead. */
  mutedTracks: Set<number>
  toggleMute: (index: number) => void
  /** Whether playback starts over at the end: of the selection, or of the piece. */
  looping: boolean
  toggleLooping: () => void
  /** The bars a selection in the score limits playback to, or null for the whole piece. */
  selection: BarRange | null
  clearSelection: () => void
}

/** Plays the whole piece again and removes the selection markers. */
function clearRange(api: alphaTab.AlphaTabApi): void {
  api.playbackRange = null
  api.clearPlaybackRangeHighlight()
}

function setLooping(api: alphaTab.AlphaTabApi, on: boolean): void {
  api.isLooping = on
}

/**
 * Muted tracks. alphaTab mutes MIDI channels and keeps them muted until told
 * otherwise, and the next piece may reuse them, so a new score starts with
 * every one of its tracks unmuted.
 */
function useTrackMute(api: alphaTab.AlphaTabApi | null, score: alphaTab.model.Score | null) {
  const [mutedTracks, setMuted] = useState<Set<number>>(new Set())

  const [mutedScore, setMutedScore] = useState(score)
  if (mutedScore !== score) {
    setMutedScore(score)
    setMuted(new Set())
  }
  useEffect(() => {
    if (api && score) api.changeTrackMute(score.tracks, false)
  }, [api, score])

  const toggleMute = useCallback(
    (index: number) => {
      const track = score?.tracks.find((t) => t.index === index)
      if (!api || !track) return
      const next = toggledIndex(mutedTracks, index)
      api.changeTrackMute([track], next.has(index))
      setMuted(next)
    },
    [api, score, mutedTracks],
  )

  return { mutedTracks, toggleMute }
}

/**
 * The stretch a click-and-drag in the score selected. alphaTab already limits
 * playback to it and a plain click clears it; this follows it as bars, and
 * drops it when a new score loads.
 */
function useSelection(api: alphaTab.AlphaTabApi | null, score: alphaTab.model.Score | null) {
  const [selection, setSelection] = useState<BarRange | null>(null)

  const [selectionScore, setSelectionScore] = useState(score)
  if (selectionScore !== score) {
    setSelectionScore(score)
    setSelection(null)
  }
  useEffect(() => {
    if (api && score) clearRange(api)
  }, [api, score])

  useEffect(() => {
    if (!api) return
    const onRangeChanged = (e: alphaTab.synth.PlaybackRangeChangedEventArgs) => {
      setSelection(barRangeOf(barStartTicks(api), e.playbackRange))
    }
    api.playbackRangeChanged.on(onRangeChanged)
    return () => api.playbackRangeChanged.off(onRangeChanged)
  }, [api])

  const clearSelection = useCallback(() => {
    if (!api) return
    clearRange(api)
    setSelection(null)
  }, [api])

  return { selection, clearSelection }
}

/**
 * Practice controls over playback: silencing tracks, looping, and playing
 * only a selected stretch. Part of useAlphaTab, which hands it the instance.
 */
export function usePlaybackControls(
  api: alphaTab.AlphaTabApi | null,
  score: alphaTab.model.Score | null,
): PlaybackControls {
  const { mutedTracks, toggleMute } = useTrackMute(api, score)
  const { selection, clearSelection } = useSelection(api, score)

  // A practice preference, like the speed: it holds across pieces.
  const [looping, setLoopingState] = useState(false)
  const toggleLooping = useCallback(() => {
    if (!api) return
    setLooping(api, !looping)
    setLoopingState(!looping)
  }, [api, looping])

  return { mutedTracks, toggleMute, looping, toggleLooping, selection, clearSelection }
}
