import * as alphaTab from '@coderline/alphatab'
import { useCallback, useEffect, useRef, useState } from 'react'

export interface Transport {
  /** True once the soundfont is loaded and playback is usable. */
  isPlayerReady: boolean
  isPlaying: boolean
  /** alphaTab parks the cursor on bar 1 when ready; only show it once playing. */
  cursorVisible: boolean
  playPause: () => void
  stop: () => void
  /** Park the playback cursor at the start of this master bar (0-based) and scroll to it. */
  seekToBar: (index: number) => void
  /** Master bar (0-based) under the playback cursor, or null while it is hidden. */
  currentBar: () => number | null
}

/** Where the cursor is, kept in a ref: alphaTab's events read and move it between renders. */
interface CursorState {
  /** Last bar the cursor reached, by playback or by clicking the score. */
  bar: number | null
  /**
   * Bar a link parked the cursor on, until the reader plays, clicks, stops or
   * changes piece. The synth can finish loading after the seek and reset to
   * bar 1 with an unprompted stop; this is what gets restored when it does.
   */
  linkedBar: number | null
  /** Tick seekToBar moved to, until the player confirms it and the view follows. */
  scrollAfterSeek: number | null
  visible: boolean
}

interface CursorContext {
  instance: alphaTab.AlphaTabApi
  cursor: CursorState
  showCursor: (visible: boolean) => void
}

/** Park the cursor on a master bar and have the view follow once it moves. */
function park({ instance, cursor, showCursor }: CursorContext, index: number): void {
  const bars = instance.score?.masterBars
  if (!bars || bars.length === 0) return

  const bar = bars[Math.min(Math.max(index, 0), bars.length - 1)]
  // alphaTab rebuilds the tick lookup synchronously after scoreLoaded, so
  // once a piece has rendered the lookup belongs to that piece.
  const ticks = instance.tickCache
  const tick = ticks ? ticks.getMasterBarStart(bar) : bar.start
  instance.tickPosition = tick
  cursor.bar = bar.index
  cursor.linkedBar = bar.index
  cursor.scrollAfterSeek = tick
  showCursor(true)
}

/** A new piece starts at the beginning with no cursor shown. */
function resetCursor(ctx: CursorContext): void {
  ctx.cursor.bar = null
  ctx.cursor.linkedBar = null
  ctx.showCursor(false)
}

/**
 * Playing shows the cursor; stop resets to bar 1 and hides it again, unless
 * a link parked it, which is put back. A pause keeps it visible so you can
 * see where you left off.
 */
function followPlayerState(ctx: CursorContext, playing: boolean, stopped: boolean): void {
  if (playing) {
    ctx.cursor.linkedBar = null
    ctx.showCursor(true)
  } else if (stopped) {
    const linked = ctx.cursor.linkedBar
    if (linked !== null) park(ctx, linked)
    else resetCursor(ctx)
  }
}

/**
 * Whether the player has confirmed the seek seekToBar made. Matched on the
 * tick: loading the MIDI emits seek events of its own near tick 0, and the
 * player reports ticks with a small shift, so not exactly.
 */
function seekArrived(e: alphaTab.synth.PositionChangedEventArgs, target: number | null) {
  return e.isSeek && target !== null && e.currentTick >= target
}

/**
 * The cursor only moves once the player confirms a seek, and alphaTab moves
 * it two animation frames later (a beginInvoke inside a beginInvoke); follow
 * it after the same two hops. Letting alphaTab scroll also supersedes its own
 * post-render scroll back to bar 1.
 */
function followSeek(ctx: CursorContext, e: alphaTab.synth.PositionChangedEventArgs): void {
  if (!seekArrived(e, ctx.cursor.scrollAfterSeek)) return
  ctx.cursor.scrollAfterSeek = null
  requestAnimationFrame(() => requestAnimationFrame(() => ctx.instance.scrollToCursor()))
}

/** Clicking the score seeks there; show the cursor so the spot is visible. */
function followClick(ctx: CursorContext, beat: alphaTab.model.Beat): void {
  ctx.cursor.linkedBar = null
  ctx.cursor.bar = beat.voice.bar.masterBar.index
  ctx.showCursor(true)
}

/** Playing, stopping and the playback cursor, over the instance useAlphaTab owns. */
export function useTransport(api: alphaTab.AlphaTabApi | null): Transport {
  const [isPlayerReady, setIsPlayerReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [cursorVisible, setCursorVisible] = useState(false)
  const cursor = useRef<CursorState>({
    bar: null,
    linkedBar: null,
    scrollAfterSeek: null,
    visible: false,
  })

  const showCursor = useCallback((visible: boolean) => {
    cursor.current.visible = visible
    setCursorVisible(visible)
  }, [])

  useEffect(() => {
    if (!api) return
    const ctx: CursorContext = { instance: api, cursor: cursor.current, showCursor }
    const onScoreLoaded = () => resetCursor(ctx)
    const onPlayerReady = () => setIsPlayerReady(true)
    const onPlayerStateChanged = (args: alphaTab.synth.PlayerStateChangedEventArgs) => {
      const playing = args.state === alphaTab.synth.PlayerState.Playing
      setIsPlaying(playing)
      followPlayerState(ctx, playing, args.stopped)
    }
    const onPositionChanged = (e: alphaTab.synth.PositionChangedEventArgs) => followSeek(ctx, e)
    const onPlayedBeatChanged = (beat: alphaTab.model.Beat) => {
      ctx.cursor.bar = beat.voice.bar.masterBar.index
    }
    const onBeatMouseDown = (beat: alphaTab.model.Beat) => followClick(ctx, beat)

    api.scoreLoaded.on(onScoreLoaded)
    api.playerReady.on(onPlayerReady)
    api.playerStateChanged.on(onPlayerStateChanged)
    api.playerPositionChanged.on(onPositionChanged)
    api.playedBeatChanged.on(onPlayedBeatChanged)
    api.beatMouseDown.on(onBeatMouseDown)
    return () => {
      api.scoreLoaded.off(onScoreLoaded)
      api.playerReady.off(onPlayerReady)
      api.playerStateChanged.off(onPlayerStateChanged)
      api.playerPositionChanged.off(onPositionChanged)
      api.playedBeatChanged.off(onPlayedBeatChanged)
      api.beatMouseDown.off(onBeatMouseDown)
      setIsPlayerReady(false)
      setIsPlaying(false)
      showCursor(false)
    }
  }, [api, showCursor])

  const playPause = useCallback(() => api?.playPause(), [api])

  const stop = useCallback(() => {
    // An explicit stop really does mean back to bar 1, even after a link.
    cursor.current.linkedBar = null
    api?.stop()
  }, [api])

  const seekToBar = useCallback(
    (index: number) => {
      if (api) park({ instance: api, cursor: cursor.current, showCursor }, index)
    },
    [api, showCursor],
  )

  const currentBar = useCallback(
    () => (cursor.current.visible ? cursor.current.bar : null),
    [],
  )

  return { isPlayerReady, isPlaying, cursorVisible, playPause, stop, seekToBar, currentBar }
}
