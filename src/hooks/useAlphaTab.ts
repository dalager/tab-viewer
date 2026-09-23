import * as alphaTab from '@coderline/alphatab'
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react'
import { buildSettings } from '@/score/settings'

export interface UseAlphaTab {
  api: alphaTab.AlphaTabApi | null
  score: alphaTab.model.Score | null
  isLoading: boolean
  error: string | null
  /** Bumps on every renderFinished; paging uses it to invalidate cached bounds. */
  renderVersion: number
  loadFile: (url: string, allTracks: boolean) => Promise<void>
  /** True once the soundfont is loaded and playback is usable. */
  isPlayerReady: boolean
  isPlaying: boolean
  metronome: boolean
  playPause: () => void
  stop: () => void
  toggleMetronome: () => void
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
  const [metronome, setMetronome] = useState(false)

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
      setIsPlaying(args.state === alphaTab.synth.PlayerState.Playing)
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
    }
  }, [containerRef, viewportRef])

  const loadFile = useCallback(async (url: string, allTracks: boolean) => {
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

      // [-1] renders every track; [0] is first-track-only.
      instance.load(buffer, allTracks ? [-1] : [0])
    } catch (e) {
      if (token !== loadToken.current) return
      setIsLoading(false)
      setError(e instanceof Error ? e.message : String(e))
    }
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
    isPlayerReady,
    isPlaying,
    metronome,
    playPause,
    stop,
    toggleMetronome,
  }
}
