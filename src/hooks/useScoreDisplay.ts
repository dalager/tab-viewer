import type * as alphaTab from '@coderline/alphatab'
import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { barStarts, computeSystemTops } from '@/score/bounds'
import { firstVisibleBar, PAGE_FRACTION, pageBy, scrollToEdge } from '@/score/paging'
import {
  LAYOUT_CYCLE,
  LAYOUT_MODES,
  type Layout,
  MAX_SCALE,
  MIN_SCALE,
} from '@/score/settings'
import { type ScoreTrack, toScoreTrack } from '@/score/tracks'

export interface ScoreDisplay {
  /** Zoom, 1.0 being alphaTab's default size. */
  scale: number
  zoomBy: (delta: number) => void
  resetZoom: () => void
  layout: Layout
  cycleLayout: () => void
  /** The open score's tracks, empty until one has loaded. */
  tracks: ScoreTrack[]
  /** Track indexes being rendered. Empty means every track; a new piece starts that way. */
  selectedTracks: Set<number>
  setSelectedTracks: (indexes: Set<number>) => void
  /** Switches between every track and the first one only. */
  toggleFirstTrackOnly: () => void
  /** Scroll a page or half a page, snapping to staff systems. */
  page: (direction: 1 | -1, size?: 'full' | 'half') => void
  scrollToEdge: (edge: 'start' | 'end') => void
  /** Master bar (0-based) at the top (or left edge) of the view. */
  topVisibleBar: () => number
}

/** Zoom and layout, applied to the instance and re-rendered. */
function useDisplaySettings(api: alphaTab.AlphaTabApi | null) {
  const [scale, setScale] = useState(1)
  const [layout, setLayout] = useState<Layout>('page')

  const applyDisplay = useCallback(
    (mutate: (display: alphaTab.DisplaySettings) => void) => {
      if (!api) return
      mutate(api.settings.display)
      api.updateSettings()
      api.render()
    },
    [api],
  )

  const zoomTo = useCallback(
    (value: number) => {
      const next = Math.round(Math.min(MAX_SCALE, Math.max(MIN_SCALE, value)) * 10) / 10
      setScale(next)
      applyDisplay((display) => {
        display.scale = next
      })
    },
    [applyDisplay],
  )

  const zoomBy = useCallback((delta: number) => zoomTo(scale + delta), [zoomTo, scale])
  const resetZoom = useCallback(() => zoomTo(1), [zoomTo])

  const cycleLayout = useCallback(() => {
    const next = LAYOUT_CYCLE[(LAYOUT_CYCLE.indexOf(layout) + 1) % LAYOUT_CYCLE.length]
    setLayout(next)
    applyDisplay((display) => {
      display.layoutMode = LAYOUT_MODES[next]
    })
  }, [layout, applyDisplay])

  return { scale, zoomBy, resetZoom, layout, cycleLayout }
}

/** The tracks alphaTab should render, `indexes` empty meaning all of them. */
function tracksToRender(score: alphaTab.model.Score, indexes: Set<number>): alphaTab.model.Track[] {
  return indexes.size === 0 ? score.tracks : score.tracks.filter((t) => indexes.has(t.index))
}

/** Every track if only the first is shown, else only the first; null without tracks. */
function firstOnlyToggled(tracks: ScoreTrack[], selected: Set<number>): Set<number> | null {
  if (tracks.length === 0) return null
  const first = tracks[0].index
  const firstOnly = selected.size === 1 && selected.has(first)
  return firstOnly ? new Set() : new Set([first])
}

/** Which tracks are rendered; a new score starts with all of them. */
function useTrackSelection(api: alphaTab.AlphaTabApi | null, score: alphaTab.model.Score | null) {
  const [selectedTracks, setSelected] = useState<Set<number>>(new Set())
  const tracks = useMemo(() => score?.tracks.map(toScoreTrack) ?? [], [score])

  // A new score is loaded with every track, so the selection starts over.
  // Adjusting during render rather than in an effect avoids a second pass.
  const [tracksScore, setTracksScore] = useState(score)
  if (tracksScore !== score) {
    setTracksScore(score)
    setSelected(new Set())
  }

  const setSelectedTracks = useCallback(
    (indexes: Set<number>) => {
      if (!api?.score) return
      const shown = tracksToRender(api.score, indexes)
      if (shown.length === 0) return
      setSelected(indexes)
      api.renderTracks(shown)
    },
    [api],
  )

  const toggleFirstTrackOnly = useCallback(() => {
    const next = firstOnlyToggled(tracks, selectedTracks)
    if (next) setSelectedTracks(next)
  }, [tracks, selectedTracks, setSelectedTracks])

  return { tracks, selectedTracks, setSelectedTracks, toggleFirstTrackOnly }
}

/** Paging and bar lookup over the rendered score, in the given layout. */
function useScrolling(
  api: alphaTab.AlphaTabApi | null,
  renderVersion: number,
  viewportRef: RefObject<HTMLDivElement | null>,
  layout: Layout,
) {
  // Staff-system boundaries, re-read once each render's bounds lookup exists.
  const systemTops = useRef<number[]>([])
  useEffect(() => {
    systemTops.current = computeSystemTops(api, viewportRef.current)
  }, [api, renderVersion, viewportRef])

  const horizontal = layout === 'horizontal'

  const page = useCallback(
    (direction: 1 | -1, size: 'full' | 'half' = 'full') => {
      const fraction = size === 'full' ? PAGE_FRACTION : PAGE_FRACTION / 2
      if (viewportRef.current) {
        pageBy(viewportRef.current, systemTops.current, direction, horizontal, fraction)
      }
    },
    [viewportRef, horizontal],
  )

  const toEdge = useCallback(
    (edge: 'start' | 'end') => {
      if (viewportRef.current) scrollToEdge(viewportRef.current, edge)
    },
    [viewportRef],
  )

  const topVisibleBar = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) return 0
    const position = horizontal ? viewport.scrollLeft : viewport.scrollTop
    return firstVisibleBar(barStarts(api, viewport, horizontal), position)
  }, [api, viewportRef, horizontal])

  return { page, scrollToEdge: toEdge, topVisibleBar }
}

/**
 * How the open score is shown: zoom, layout, which tracks, and scrolling
 * through it. Part of useAlphaTab, which hands it the instance; nothing
 * outside the score hooks touches alphaTab's display settings or bounds.
 */
export function useScoreDisplay(
  api: alphaTab.AlphaTabApi | null,
  score: alphaTab.model.Score | null,
  renderVersion: number,
  viewportRef: RefObject<HTMLDivElement | null>,
): ScoreDisplay {
  const settings = useDisplaySettings(api)
  const trackSelection = useTrackSelection(api, score)
  const scrolling = useScrolling(api, renderVersion, viewportRef, settings.layout)
  return { ...settings, ...trackSelection, ...scrolling }
}
