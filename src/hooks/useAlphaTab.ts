import * as alphaTab from '@coderline/alphatab'
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react'
import { type ScoreDisplay, useScoreDisplay } from '@/hooks/useScoreDisplay'
import { errorMessage, fetchBytes } from '@/lib/utils'
import { buildSettings, MAX_SPEED, MIN_SPEED, NYLON_GUITAR_PROGRAM } from '@/score/settings'

export interface UseAlphaTab extends ScoreDisplay {
  /** True once the alphaTab instance exists and `loadFile` can be used. */
  ready: boolean
  isLoading: boolean
  error: string | null
  /**
   * Bumps once each render's bounds lookup is built (postRenderFinished, not
   * renderFinished, which fires before it exists); a bar link waits for it.
   */
  renderVersion: number
  /** Load a piece by URL; http for hosted songbooks, blob for .sbk pieces and imports. */
  loadFile: (url: string) => Promise<void>
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
  /** Park the playback cursor at the start of this master bar (0-based) and scroll to it. */
  seekToBar: (index: number) => void
  /** Master bar (0-based) under the playback cursor, or null while it is hidden. */
  currentBar: () => number | null
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
 * Owns the single AlphaTabApi instance for the session, and is the only way
 * the rest of the app reaches it: callers get operations in the app's own
 * terms (useScoreDisplay covers zoom, layout, tracks and paging), never the api.
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

  /** Last bar the cursor reached, by playback or by clicking the score. */
  const cursorBar = useRef<number | null>(null)
  const cursorVisibleRef = useRef(false)
  /** Tick seekToBar moved to, until the player confirms it and the view follows. */
  const scrollAfterSeek = useRef<number | null>(null)
  /**
   * Bar a link parked the cursor on, until the reader plays, clicks, stops or
   * changes piece. The synth can finish loading after the seek and reset to
   * bar 1 with an unprompted stop; this is what gets restored when it does.
   */
  const linkedBar = useRef<number | null>(null)

  /** Park the cursor on a master bar and have the view follow once it moves. */
  const parkAt = useCallback((instance: alphaTab.AlphaTabApi, index: number) => {
    const bars = instance.score?.masterBars
    if (!bars || bars.length === 0) return

    const bar = bars[Math.min(Math.max(index, 0), bars.length - 1)]
    // alphaTab rebuilds the tick lookup synchronously after scoreLoaded, so
    // once a piece has rendered the lookup belongs to that piece.
    const ticks = instance.tickCache
    const tick = ticks ? ticks.getMasterBarStart(bar) : bar.start
    instance.tickPosition = tick
    cursorBar.current = bar.index
    linkedBar.current = bar.index
    scrollAfterSeek.current = tick
    cursorVisibleRef.current = true
    setCursorVisible(true)
  }, [])

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
      cursorVisibleRef.current = false
      cursorBar.current = null
      linkedBar.current = null
      instance.playbackSpeed = speedRef.current

      // Remember what this file asked for before any override touches it.
      originalPrograms.current = new Map(s.tracks.map((t) => [t.index, t.playbackInfo.program]))
      if (guitarOnlyRef.current) {
        applyPrograms(s, true)
        instance.loadMidiForScore()
      }
    }
    const onRenderFinished = () => setIsLoading(false)
    const onPostRenderFinished = () => setRenderVersion((v) => v + 1)
    const onError = (e: unknown) => {
      setIsLoading(false)
      setError(`Could not render this piece: ${errorMessage(e)}`)
    }
    const onPlayerReady = () => setIsPlayerReady(true)
    const showCursor = (visible: boolean) => {
      cursorVisibleRef.current = visible
      setCursorVisible(visible)
    }
    const onPlayerStateChanged = (args: alphaTab.synth.PlayerStateChangedEventArgs) => {
      const playing = args.state === alphaTab.synth.PlayerState.Playing
      setIsPlaying(playing)
      // Playing shows the cursor; stop resets to bar 1 and hides it again.
      // A pause keeps it visible so you can see where you left off.
      if (playing) {
        linkedBar.current = null
        showCursor(true)
      } else if (args.stopped) {
        if (linkedBar.current !== null) {
          parkAt(instance, linkedBar.current)
          return
        }
        showCursor(false)
        cursorBar.current = null
      }
    }
    // The cursor only moves once the player confirms a seek, and alphaTab moves
    // it two animation frames later (a beginInvoke inside a beginInvoke);
    // follow it after the same two hops. Letting
    // alphaTab scroll also supersedes its own post-render scroll back to bar 1.
    // Matched on the tick: loading the MIDI emits seek events of its own near
    // tick 0, and the player reports ticks with a small shift, so not exactly.
    const onPlayerPositionChanged = (e: alphaTab.synth.PositionChangedEventArgs) => {
      const target = scrollAfterSeek.current
      if (!e.isSeek || target === null || e.currentTick < target) return
      scrollAfterSeek.current = null
      requestAnimationFrame(() => requestAnimationFrame(() => instance.scrollToCursor()))
    }
    const onPlayedBeatChanged = (beat: alphaTab.model.Beat) => {
      cursorBar.current = beat.voice.bar.masterBar.index
    }
    // Clicking the score seeks there; show the cursor so the spot is visible.
    const onBeatMouseDown = (beat: alphaTab.model.Beat) => {
      linkedBar.current = null
      cursorBar.current = beat.voice.bar.masterBar.index
      showCursor(true)
    }

    instance.scoreLoaded.on(onScoreLoaded)
    instance.renderFinished.on(onRenderFinished)
    instance.postRenderFinished.on(onPostRenderFinished)
    instance.error.on(onError)
    instance.playerReady.on(onPlayerReady)
    instance.playerStateChanged.on(onPlayerStateChanged)
    instance.playerPositionChanged.on(onPlayerPositionChanged)
    instance.playedBeatChanged.on(onPlayedBeatChanged)
    instance.beatMouseDown.on(onBeatMouseDown)

    return () => {
      instance.scoreLoaded.off(onScoreLoaded)
      instance.renderFinished.off(onRenderFinished)
      instance.postRenderFinished.off(onPostRenderFinished)
      instance.error.off(onError)
      instance.playerReady.off(onPlayerReady)
      instance.playerStateChanged.off(onPlayerStateChanged)
      instance.playerPositionChanged.off(onPlayerPositionChanged)
      instance.playedBeatChanged.off(onPlayedBeatChanged)
      instance.beatMouseDown.off(onBeatMouseDown)
      instance.destroy()
      apiRef.current = null
      setApi(null)
      setIsPlayerReady(false)
      setIsPlaying(false)
      setCursorVisible(false)
      cursorVisibleRef.current = false
    }
  }, [containerRef, viewportRef, parkAt])

  /** Marks a new load as the current one; any earlier in-flight fetch is dropped. */
  const beginLoad = useCallback(() => {
    setIsLoading(true)
    setError(null)
    return ++loadToken.current
  }, [])

  const loadFile = useCallback(
    async (url: string) => {
      const instance = apiRef.current
      if (!instance) return

      const token = beginLoad()
      try {
        const bytes = await fetchBytes(url)
        if (token !== loadToken.current) return // superseded by a newer selection
        // Always load every track ([-1]); which ones are *rendered* is a separate
        // concern handled by renderTracks, so toggling needs no refetch.
        instance.load(bytes.buffer, [-1])
      } catch (e) {
        if (token !== loadToken.current) return
        setIsLoading(false)
        setError(`Could not load this piece: ${errorMessage(e)}`)
      }
    },
    [beginLoad],
  )

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
    // An explicit stop really does mean back to bar 1, even after a link.
    linkedBar.current = null
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

  const seekToBar = useCallback(
    (index: number) => {
      if (apiRef.current) parkAt(apiRef.current, index)
    },
    [parkAt],
  )

  const currentBar = useCallback(
    () => (cursorVisibleRef.current ? cursorBar.current : null),
    [],
  )

  const display = useScoreDisplay(api, score, renderVersion, viewportRef)

  return {
    ...display,
    ready: api !== null,
    isLoading,
    error,
    renderVersion,
    loadFile,
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
    seekToBar,
    currentBar,
  }
}
