import * as alphaTab from '@coderline/alphatab'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ScoreView } from '@/components/ScoreView'
import { ShortcutHelp } from '@/components/ShortcutHelp'
import { TabCommandPalette } from '@/components/TabCommandPalette'
import { TabSidebar } from '@/components/TabSidebar'
import { Toolbar } from '@/components/Toolbar'
import { tabs } from '@/data/tabs'
import { useAlphaTab } from '@/hooks/useAlphaTab'
import { useFullscreen } from '@/hooks/useFullscreen'
import { type Shortcut, useHotkeys } from '@/hooks/useHotkeys'
import { computeSystemTops, pageBy, scrollToEdge } from '@/score/paging'
import { LAYOUT_CYCLE, MAX_SCALE, MIN_SCALE, SPEED_STEP } from '@/score/settings'

const STORAGE_KEY = 'tab-viewer:selected'

export default function App() {
  const shellRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  const [selectedId, setSelectedId] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY) ?? tabs[0]?.id ?? null,
  )
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  // Empty set means "render every track".
  const [selectedTracks, setSelectedTracks] = useState<Set<number>>(new Set())
  const [scale, setScale] = useState(1)
  const [layoutMode, setLayoutMode] = useState<alphaTab.LayoutMode>(alphaTab.LayoutMode.Page)

  const {
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
  } = useAlphaTab(canvasRef, viewportRef)
  const { isFullscreen, toggle: toggleFullscreen, exit: exitFullscreen } = useFullscreen(shellRef)

  const selectedIndex = useMemo(() => tabs.findIndex((t) => t.id === selectedId), [selectedId])
  const selected = selectedIndex >= 0 ? tabs[selectedIndex] : null

  // Cached staff-system boundaries, invalidated whenever a render completes.
  const systemTops = useRef<number[]>([])
  useEffect(() => {
    systemTops.current = computeSystemTops(api, viewportRef.current)
  }, [api, renderVersion])

  useEffect(() => {
    if (selectedId) localStorage.setItem(STORAGE_KEY, selectedId)
  }, [selectedId])

  // A new piece starts with every track shown again. Adjusting during render
  // rather than inside the load effect avoids a cascading second render.
  const [tracksPiece, setTracksPiece] = useState(selectedId)
  if (tracksPiece !== selectedId) {
    setTracksPiece(selectedId)
    setSelectedTracks(new Set())
  }

  useEffect(() => {
    if (!selected || !api) return
    void loadFile(selected.file)
    viewportRef.current?.scrollTo({ top: 0 })
  }, [selected, api, loadFile])

  const changeTracks = useCallback(
    (next: Set<number>) => {
      setSelectedTracks(next)
      renderTracks(next)
    },
    [renderTracks],
  )

  // `t` cycles between every track and the first one only.
  const toggleTracks = useCallback(() => {
    const all = score?.tracks ?? []
    if (all.length === 0) return
    const firstOnly = selectedTracks.size === 1 && selectedTracks.has(all[0].index)
    changeTracks(firstOnly ? new Set() : new Set([all[0].index]))
  }, [score, selectedTracks, changeTracks])

  const applyDisplaySetting = useCallback(
    (mutate: () => void) => {
      if (!api) return
      mutate()
      api.updateSettings()
      api.render()
    },
    [api],
  )

  const zoomBy = useCallback(
    (delta: number) => {
      const next = Math.round(Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale + delta)) * 10) / 10
      setScale(next)
      applyDisplaySetting(() => {
        if (api) api.settings.display.scale = next
      })
    },
    [api, scale, applyDisplaySetting],
  )

  const resetZoom = useCallback(() => {
    setScale(1)
    applyDisplaySetting(() => {
      if (api) api.settings.display.scale = 1
    })
  }, [api, applyDisplaySetting])

  const cycleLayout = useCallback(() => {
    const next = LAYOUT_CYCLE[(LAYOUT_CYCLE.indexOf(layoutMode) + 1) % LAYOUT_CYCLE.length]
    setLayoutMode(next)
    applyDisplaySetting(() => {
      if (api) api.settings.display.layoutMode = next
    })
  }, [api, layoutMode, applyDisplaySetting])

  const step = useCallback(
    (direction: 1 | -1, fraction: number) => {
      const viewport = viewportRef.current
      if (viewport) pageBy(viewport, systemTops.current, direction, layoutMode, fraction)
    },
    [layoutMode],
  )

  const goToPiece = useCallback(
    (offset: 1 | -1) => {
      if (tabs.length === 0) return
      const base = selectedIndex >= 0 ? selectedIndex : 0
      const next = (base + offset + tabs.length) % tabs.length
      setSelectedId(tabs[next].id)
    },
    [selectedIndex],
  )

  const overlayOpen = paletteOpen || helpOpen

  const shortcuts = useMemo<Shortcut[]>(
    () => [
      {
        keys: ['PageDown'],
        label: 'PageDown',
        description: 'Next page',
        group: 'Reading',
        run: () => step(1, 0.92),
      },
      {
        keys: ['PageUp'],
        label: 'PageUp',
        description: 'Previous page',
        group: 'Reading',
        run: () => step(-1, 0.92),
      },
      {
        keys: ['j'],
        label: 'j',
        description: 'Half page down',
        group: 'Reading',
        run: () => step(1, 0.46),
      },
      {
        keys: ['k'],
        label: 'k',
        description: 'Half page up',
        group: 'Reading',
        run: () => step(-1, 0.46),
      },
      {
        keys: ['Home'],
        label: 'Home',
        description: 'Start of score',
        group: 'Reading',
        run: () => {
          if (viewportRef.current) scrollToEdge(viewportRef.current, 'start')
        },
      },
      {
        keys: ['End'],
        label: 'End',
        description: 'End of score',
        group: 'Reading',
        run: () => {
          if (viewportRef.current) scrollToEdge(viewportRef.current, 'end')
        },
      },

      {
        keys: ['n', ']'],
        label: 'n / ]',
        description: 'Next piece',
        group: 'Collection',
        run: () => goToPiece(1),
      },
      {
        keys: ['p', '['],
        label: 'p / [',
        description: 'Previous piece',
        group: 'Collection',
        run: () => goToPiece(-1),
      },
      {
        keys: ['k'],
        label: 'Ctrl+K',
        description: 'Open search palette',
        group: 'Collection',
        withCtrl: true,
        run: () => setPaletteOpen(true),
      },
      {
        keys: ['/'],
        label: '/',
        description: 'Open search palette',
        group: 'Collection',
        run: () => setPaletteOpen(true),
      },

      {
        keys: ['f'],
        label: 'f',
        description: 'Toggle full screen',
        group: 'View',
        run: toggleFullscreen,
      },
      {
        keys: ['b'],
        label: 'b',
        description: 'Toggle sidebar',
        group: 'View',
        run: () => setSidebarOpen((v) => !v),
      },
      {
        keys: ['l'],
        label: 'l',
        description: 'Cycle layout mode',
        group: 'View',
        run: cycleLayout,
      },
      {
        keys: ['t'],
        label: 't',
        description: 'All tracks / first track',
        group: 'View',
        run: toggleTracks,
      },
      {
        keys: ['+', '='],
        label: '+',
        description: 'Zoom in',
        group: 'View',
        run: () => zoomBy(0.1),
      },
      {
        keys: ['-'],
        label: '-',
        description: 'Zoom out',
        group: 'View',
        run: () => zoomBy(-0.1),
      },
      {
        keys: ['0'],
        label: '0',
        description: 'Reset zoom',
        group: 'View',
        run: resetZoom,
      },

      {
        keys: [' '],
        label: 'Space',
        description: 'Play / pause',
        group: 'Playback',
        run: playPause,
      },
      {
        keys: ['s'],
        label: 's',
        description: 'Stop',
        group: 'Playback',
        run: stop,
      },
      {
        keys: ['m'],
        label: 'm',
        description: 'Toggle metronome',
        group: 'Playback',
        run: toggleMetronome,
      },
      {
        keys: ['g'],
        label: 'g',
        description: 'Play everything on nylon guitar',
        group: 'Playback',
        run: toggleGuitarOnly,
      },
      {
        keys: [','],
        label: ',',
        description: 'Slower',
        group: 'Playback',
        run: () => nudgeSpeed(-SPEED_STEP),
      },
      {
        keys: ['.'],
        label: '.',
        description: 'Faster',
        group: 'Playback',
        run: () => nudgeSpeed(SPEED_STEP),
      },
      {
        keys: ['\\'],
        label: '\\',
        description: 'Reset speed to 100%',
        group: 'Playback',
        run: () => setSpeed(1),
      },

      {
        keys: ['?'],
        label: '?',
        description: 'Toggle this help',
        group: 'Overlays',
        allowInOverlay: true,
        run: () => setHelpOpen((v) => !v),
      },
      {
        keys: ['Escape'],
        label: 'Esc',
        description: 'Close overlay, else leave full screen',
        group: 'Overlays',
        allowInOverlay: true,
        run: () => {
          if (helpOpen) setHelpOpen(false)
          else if (paletteOpen) setPaletteOpen(false)
          else void exitFullscreen()
        },
      },
    ],
    [
      step,
      goToPiece,
      toggleFullscreen,
      cycleLayout,
      toggleTracks,
      zoomBy,
      resetZoom,
      exitFullscreen,
      helpOpen,
      paletteOpen,
      playPause,
      stop,
      toggleMetronome,
      setSpeed,
      nudgeSpeed,
      toggleGuitarOnly,
    ],
  )

  useHotkeys(shortcuts, overlayOpen)

  return (
    <div ref={shellRef} className="flex h-screen w-screen flex-col overflow-hidden bg-white">
      <Toolbar
        tab={selected}
        tracks={score?.tracks ?? []}
        selectedTracks={selectedTracks}
        onTracksChange={changeTracks}
        scale={scale}
        layoutMode={layoutMode}
        isFullscreen={isFullscreen}
        sidebarOpen={sidebarOpen}
        isPlayerReady={isPlayerReady}
        isPlaying={isPlaying}
        metronome={metronome}
        speed={speed}
        onSpeedChange={setSpeed}
        guitarOnly={guitarOnly}
        onToggleGuitarOnly={toggleGuitarOnly}
        onPlayPause={playPause}
        onStop={stop}
        onToggleMetronome={toggleMetronome}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        onCycleLayout={cycleLayout}
        onZoom={zoomBy}
        onResetZoom={resetZoom}
        onToggleFullscreen={toggleFullscreen}
        onOpenPalette={() => setPaletteOpen(true)}
        onOpenHelp={() => setHelpOpen(true)}
      />

      <div className="flex min-h-0 flex-1">
        {sidebarOpen && <TabSidebar tabs={tabs} selectedId={selectedId} onSelect={setSelectedId} />}
        <ScoreView
          viewportRef={viewportRef}
          canvasRef={canvasRef}
          isLoading={isLoading}
          error={error}
          cursorVisible={cursorVisible}
        />
      </div>

      <TabCommandPalette
        tabs={tabs}
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onSelect={setSelectedId}
      />
      <ShortcutHelp shortcuts={shortcuts} open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  )
}
