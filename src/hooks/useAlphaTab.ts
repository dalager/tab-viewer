import * as alphaTab from '@coderline/alphatab'
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react'
import { type PlaybackControls, usePlaybackControls } from '@/hooks/usePlaybackControls'
import { type PlayerSettings, usePlayerSettings } from '@/hooks/usePlayerSettings'
import { type ScoreDisplay, useScoreDisplay } from '@/hooks/useScoreDisplay'
import { type Transport, useTransport } from '@/hooks/useTransport'
import { errorMessage, fetchBytes } from '@/lib/utils'
import { buildSettings } from '@/score/settings'

export interface UseAlphaTab extends ScoreDisplay, PlaybackControls, PlayerSettings, Transport {
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
}

/**
 * The instance itself: created on the container, destroyed on unmount, and
 * the score it has loaded and rendered.
 *
 * The effect cleanup calls api.destroy(), which also covers React StrictMode's
 * double-mount in dev (two instances would otherwise mean two worker pairs).
 */
function useInstance(
  containerRef: RefObject<HTMLDivElement | null>,
  viewportRef: RefObject<HTMLDivElement | null>,
) {
  const [api, setApi] = useState<alphaTab.AlphaTabApi | null>(null)
  const [score, setScore] = useState<alphaTab.model.Score | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [renderVersion, setRenderVersion] = useState(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const instance = new alphaTab.AlphaTabApi(el, buildSettings(viewportRef.current))
    setApi(instance)

    const onScoreLoaded = (s: alphaTab.model.Score) => {
      setScore(s)
      setError(null)
    }
    const onRenderFinished = () => setIsLoading(false)
    const onPostRenderFinished = () => setRenderVersion((v) => v + 1)
    const onError = (e: unknown) => {
      setIsLoading(false)
      setError(`Could not render this piece: ${errorMessage(e)}`)
    }

    instance.scoreLoaded.on(onScoreLoaded)
    instance.renderFinished.on(onRenderFinished)
    instance.postRenderFinished.on(onPostRenderFinished)
    instance.error.on(onError)
    return () => {
      instance.scoreLoaded.off(onScoreLoaded)
      instance.renderFinished.off(onRenderFinished)
      instance.postRenderFinished.off(onPostRenderFinished)
      instance.error.off(onError)
      instance.destroy()
      setApi(null)
    }
  }, [containerRef, viewportRef])

  return { api, score, isLoading, setIsLoading, error, setError, renderVersion }
}

/** Fetches a piece's file and hands it to alphaTab; a newer load supersedes an older one. */
function useLoadFile(
  api: alphaTab.AlphaTabApi | null,
  setIsLoading: (loading: boolean) => void,
  setError: (error: string | null) => void,
) {
  // Guards against out-of-order responses when paging pieces quickly.
  const loadToken = useRef(0)

  return useCallback(
    async (url: string) => {
      if (!api) return
      setIsLoading(true)
      setError(null)
      const token = ++loadToken.current
      try {
        const bytes = await fetchBytes(url)
        if (token !== loadToken.current) return // superseded by a newer selection
        // Always load every track ([-1]); which ones are *rendered* is a separate
        // concern handled by renderTracks, so toggling needs no refetch.
        api.load(bytes.buffer, [-1])
      } catch (e) {
        if (token !== loadToken.current) return
        setIsLoading(false)
        setError(`Could not load this piece: ${errorMessage(e)}`)
      }
    },
    [api, setIsLoading, setError],
  )
}

/**
 * Owns the single AlphaTabApi instance for the session, and is the only way
 * the rest of the app reaches it: callers get operations in the app's own
 * terms, never the api. The parts each own one concern: useTransport playing
 * and the cursor, usePlayerSettings how it sounds, usePlaybackControls the
 * practice controls, and useScoreDisplay zoom, layout, tracks and paging.
 */
export function useAlphaTab(
  containerRef: RefObject<HTMLDivElement | null>,
  viewportRef: RefObject<HTMLDivElement | null>,
): UseAlphaTab {
  const { api, score, isLoading, setIsLoading, error, setError, renderVersion } = useInstance(
    containerRef,
    viewportRef,
  )
  const loadFile = useLoadFile(api, setIsLoading, setError)

  return {
    ...useScoreDisplay(api, score, renderVersion, viewportRef),
    ...usePlaybackControls(api, score),
    ...usePlayerSettings(api),
    ...useTransport(api),
    ready: api !== null,
    isLoading,
    error,
    renderVersion,
    loadFile,
  }
}
