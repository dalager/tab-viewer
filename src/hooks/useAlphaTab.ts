import * as alphaTab from '@coderline/alphatab'
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react'
import { buildSettings, MAX_SPEED, MIN_SPEED, NYLON_GUITAR_PROGRAM } from '@/score/settings'

export interface UseAlphaTab {
  api: alphaTab.AlphaTabApi | null
  score: alphaTab.model.Score | null
  isLoading: boolean
  error: string | null
  /** Bumps on every renderFinished; paging uses it to invalidate cached bounds. */
  renderVersion: number
  loadFile: (url: string) => Promise<void>
  /** Render only these track indexes. Empty set is treated as "all". */
  renderTracks: (indexes: Set<number>) => void
  /** True once the soundfont is loaded and playback is usable. */
  isPlayerReady: boolean
  isPlaying: boolean
  /** alphaTab parks the cursor on bar 1 when ready; only show it once playing. */
  cursorVisible: boolean
  metronome: boolean
  /** Playback speed, 1.0 being the written tempo. */
  speed: number
  setSpeed: (value: number) => void
  /** Adjust relative to the current speed, immune to stale closures. */
  nudgeSpeed: (delta: number) => void
  /** Play every non-percussion track on nylon guitar, ignoring the file's own instruments. */
  guitarOnly: boolean
  toggleGuitarOnly: () => void
  playPause: () => void
  stop: () => void
  toggleMetronome: () => void
}

/**
 * Point every pitched track at nylon guitar, or restore what the file asked for.
 * Percussion is left alone: its "program" is a kit, not an instrument.
 */
function applyPrograms(
  score: alphaTab.model.Score,
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

/**
 * Owns the single AlphaTabApi instance for the session.
 *
 * The effect cleanup calls api.destroy(), which also covers React StrictMode's
 * double-mount in dev (two instances would otherwise mean two worker pairs).
 */
export function useAlphaTab(
  containerRef: RefObject<HTMLDivElement | null>,
  viewportRef: RefObject<HTMLDivElement | null>,
): UseAlphaTab {
  const apiRef = useRef<alphaTab.AlphaTabApi | null>(null)
  const [api, setApi] = useState<alphaTab.AlphaTabApi | null>(null)
  const [score, setScore] = useState<alphaTab.model.Score | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [renderVersion, setRenderVersion] = useState(0)
  const [isPlayerReady, setIsPlayerReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [cursorVisible, setCursorVisible] = useState(false)
  const [metronome, setMetronome] = useState(false)
  const [speed, setSpeedState] = useState(1)
  const [guitarOnly, setGuitarOnly] = useState(false)

  // A practice tempo should survive switching pieces, so it is re-applied on
  // every load rather than reset. Same for the instrument override.
  const speedRef = useRef(1)
  const guitarOnlyRef = useRef(false)

  /** The programs the file itself asked for, so the override can be undone. */
  const originalPrograms = useRef(new Map<number, number>())

  // Guards against out-of-order responses when paging pieces quickly.
  const loadToken = useRef(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const instance = new alphaTab.AlphaTabApi(el, buildSettings(viewportRef.current))
    apiRef.current = instance
    setApi(instance)

    const onScoreLoaded = (s: alphaTab.model.Score) => {
      setScore(s)
      setError(null)
      // A new piece starts at the beginning with no cursor shown.
      setCursorVisible(false)
      instance.playbackSpeed = speedRef.current

      // Remember what this file asked for before any override touches it.
      originalPrograms.current = new Map(s.tracks.map((t) => [t.index, t.playbackInfo.program]))
      if (guitarOnlyRef.current) {
        applyPrograms(s, true)
        instance.loadMidiForScore()
      }
    }
    const onRenderFinished = () => {
      setIsLoading(false)
      setRenderVersion((v) => v + 1)
    }
    const onError = (e: unknown) => {
      setIsLoading(false)
      setError(e instanceof Error ? e.message : String(e))
    }
    const onPlayerReady = () => setIsPlayerReady(true)
    const onPlayerStateChanged = (args: alphaTab.synth.PlayerStateChangedEventArgs) => {
      const playing = args.state === alphaTab.synth.PlayerState.Playing
      setIsPlaying(playing)
      // Playing shows the cursor; stop resets to bar 1 and hides it again.
      // A pause keeps it visible so you can see where you left off.
      if (playing) setCursorVisible(true)
      else if (args.stopped) setCursorVisible(false)
    }

    instance.scoreLoaded.on(onScoreLoaded)
    instance.renderFinished.on(onRenderFinished)
    instance.error.on(onError)
    instance.playerReady.on(onPlayerReady)
    instance.playerStateChanged.on(onPlayerStateChanged)

    return () => {
      instance.scoreLoaded.off(onScoreLoaded)
      instance.renderFinished.off(onRenderFinished)
      instance.error.off(onError)
      instance.playerReady.off(onPlayerReady)
      instance.playerStateChanged.off(onPlayerStateChanged)
      instance.destroy()
      apiRef.current = null
      setApi(null)
      setIsPlayerReady(false)
      setIsPlaying(false)
      setCursorVisible(false)
    }
  }, [containerRef, viewportRef])

  const loadFile = useCallback(async (url: string) => {
    const instance = apiRef.current
    if (!instance) return

    const token = ++loadToken.current
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
      const buffer = await response.arrayBuffer()
      if (token !== loadToken.current) return // superseded by a newer selection

      // Always load every track ([-1]); which ones are *rendered* is a separate
      // concern handled by renderTracks, so toggling needs no refetch.
      instance.load(buffer, [-1])
    } catch (e) {
      if (token !== loadToken.current) return
      setIsLoading(false)
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  const renderTracks = useCallback((indexes: Set<number>) => {
    const instance = apiRef.current
    const tracks = instance?.score?.tracks
    if (!instance || !tracks) return

    const selected = indexes.size === 0 ? tracks : tracks.filter((t) => indexes.has(t.index))
    if (selected.length === 0) return
    instance.renderTracks(selected)
  }, [])

  const setSpeed = useCallback((value: number) => {
    // Rounded to whole percent so repeated steps do not drift.
    const next = Math.round(Math.min(MAX_SPEED, Math.max(MIN_SPEED, value)) * 100) / 100
    speedRef.current = next
    setSpeedState(next)
    if (apiRef.current) apiRef.current.playbackSpeed = next
  }, [])

  // Reads the ref rather than state so repeated presses inside one React batch
  // each apply, instead of all computing from the same stale value.
  const nudgeSpeed = useCallback(
    (delta: number) => {
      setSpeed(speedRef.current + delta)
    },
    [setSpeed],
  )

  const toggleGuitarOnly = useCallback(() => {
    const instance = apiRef.current
    const currentScore = instance?.score
    if (!instance || !currentScore) return

    const next = !guitarOnlyRef.current
    guitarOnlyRef.current = next
    setGuitarOnly(next)

    applyPrograms(currentScore, next, originalPrograms.current)
    // Program changes live in the generated MIDI, so it has to be rebuilt.
    // This stops playback, which is why it is not bound to a hold-to-repeat key.
    instance.loadMidiForScore()
  }, [])

  const playPause = useCallback(() => {
    apiRef.current?.playPause()
  }, [])

  const stop = useCallback(() => {
    apiRef.current?.stop()
  }, [])

  const toggleMetronome = useCallback(() => {
    const instance = apiRef.current
    if (!instance) return
    setMetronome((on) => {
      instance.metronomeVolume = on ? 0 : 1
      return !on
    })
  }, [])

  return {
    api,
    score,
    isLoading,
    error,
    renderVersion,
    loadFile,
    renderTracks,
    isPlayerReady,
    isPlaying,
    cursorVisible,
    metronome,
    speed,
    setSpeed,
    nudgeSpeed,
    guitarOnly,
    toggleGuitarOnly,
    playPause,
    stop,
    toggleMetronome,
  }
}
