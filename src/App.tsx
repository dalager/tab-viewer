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
import { IMPORT_ACCEPT, useImportedTabs } from '@/hooks/useImportedTabs'
import { parseLocation, piecePath, pieceUrl } from '@/lib/permalink'
import { computeSystemTops, pageBy, scrollToEdge, topVisibleBar } from '@/score/paging'
import { LAYOUT_CYCLE, MAX_SCALE, MIN_SCALE, SPEED_STEP } from '@/score/settings'

const STORAGE_KEY = 'tab-viewer:selected'
const COPIED_FEEDBACK_MS = 1500

/** A bar (1-based) to jump to once the given piece has rendered. */
interface PendingBar {
  id: string
  bar: number
}

function pendingBarFrom(loc: Location): PendingBar | null {
  const { id, bar } = parseLocation(loc)
  return id && bar ? { id, bar } : null
}

export default function App() {
  const shellRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  const [selectedId, setSelectedId] = useState<string | null>(
    () => parseLocation().id ?? localStorage.getItem(STORAGE_KEY) ?? tabs[0]?.id ?? null,
  )
  const pendingBar = useRef<PendingBar | null>(pendingBarFrom(window.location))
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  // Empty set means "render every track".
  const [selectedTracks, setSelectedTracks] = useState<Set<number>>(new Set())
  const [scale, setScale] = useState(1)
  const [layoutMode, setLayoutMode] = useState<alphaTab.LayoutMode>(alphaTab.LayoutMode.Page)
  const [dragDepth, setDragDepth] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    imported,
    ready: importedReady,
    error: importError,
    importFiles,
    removeImported,
    getBytes,
  } = useImportedTabs()

  // Imported pieces first, so they sit at the top of the sidebar.
  const allTabs = useMemo(() => [...imported, ...tabs], [imported])

  const {
    api,
    score,
    isLoading,
    error,
    renderVersion,
    loadFile,
    loadBytes,
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
    seekToBar,
    currentBar,
  } = useAlphaTab(canvasRef, viewportRef)
  const { isFullscreen, toggle: toggleFullscreen, exit: exitFullscreen } = useFullscreen(shellRef)

  const selectedIndex = useMemo(
    () => allTabs.findIndex((t) => t.id === selectedId),
    [allTabs, selectedId],
  )
  const selected = selectedIndex >= 0 ? allTabs[selectedIndex] : null

  // A remembered selection may point at an import that has since been removed
  // (or one not yet read from IndexedDB). Once the imports are known, fall back
  // to the first bundled piece rather than showing nothing. Adjusted during
  // render, like tracksPiece below, so it settles in the same pass.
  const fallbackId = tabs[0]?.id ?? null
  if (importedReady && selectedIndex < 0 && selectedId !== fallbackId) {
    setSelectedId(fallbackId)
  }

  // Cached staff-system boundaries, invalidated whenever a render completes.
  const systemTops = useRef<number[]>([])
  useEffect(() => {
    systemTops.current = computeSystemTops(api, viewportRef.current)
  }, [api, renderVersion])

  // Read by effects that must not re-run when it changes: a new selection
  // must wait for its own render before a pending bar can be applied to it.
  const selectedIdRef = useRef(selectedId)
  useEffect(() => {
    selectedIdRef.current = selectedId
  }, [selectedId])

  // A link to a bar is applied once, on the first render of its piece, so
  // later re-renders (zoom, tracks, layout) leave the reader where they are.
  useEffect(() => {
    const pending = pendingBar.current
    if (!pending || renderVersion === 0 || pending.id !== selectedIdRef.current) return
    pendingBar.current = null
    seekToBar(pending.bar - 1)
  }, [renderVersion, seekToBar])

  useEffect(() => {
    if (selectedId) localStorage.setItem(STORAGE_KEY, selectedId)
  }, [selectedId])

  // Keep the address bar a permalink to the open piece. Moving between known
  // pieces adds history entries; landing on "/" or on a slug that no longer
  // exists is corrected in place instead, so Back does not return to it.
  useEffect(() => {
    if (!selectedId) return
    const target = piecePath(selectedId)
    if (window.location.pathname === target) return
    const current = parseLocation().id
    const known = current !== null && allTabs.some((t) => t.id === current)
    if (known) window.history.pushState(null, '', target)
    else window.history.replaceState(null, '', target)
  }, [selectedId, allTabs])

  useEffect(() => {
    const onPopState = () => {
      const { id } = parseLocation()
      if (!id) return
      const pending = pendingBarFrom(window.location)
      if (id === selectedIdRef.current) {
        // Same piece, already rendered: nothing will re-render, so jump now.
        pendingBar.current = null
        if (pending) seekToBar(pending.bar - 1)
      } else {
        pendingBar.current = pending
        setSelectedId(id)
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [seekToBar])

  // A new piece starts with every track shown again. Adjusting during render
  // rather than inside the load effect avoids a cascading second render.
  const [tracksPiece, setTracksPiece] = useState(selectedId)
  if (tracksPiece !== selectedId) {
    setTracksPiece(selectedId)
    setSelectedTracks(new Set())
  }

  useEffect(() => {
    if (!selected || !api) return
    if (selected.imported) {
      const bytes = getBytes(selected.id)
      if (bytes) loadBytes(bytes)
    } else {
      void loadFile(selected.file)
    }
    viewportRef.current?.scrollTo({ top: 0 })
  }, [selected, api, loadFile, loadBytes, getBytes])

  // Importing selects the last file added, so it shows up straight away.
  const handleImport = useCallback(
    async (files: Iterable<File>) => {
      const ids = await importFiles(files)
      const last = ids.at(-1)
      if (last) setSelectedId(last)
    },
    [importFiles],
  )

  const openImportDialog = useCallback(() => fileInputRef.current?.click(), [])

  // Drag-and-drop anywhere in the app. dragenter/dragleave fire for every
  // child crossed, so a depth counter tells a real leave from a nested one.
  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes('Files')
  const onDragEnter = (e: React.DragEvent) => {
    if (!hasFiles(e)) return
    e.preventDefault()
    setDragDepth((d) => d + 1)
  }
  const onDragOver = (e: React.DragEvent) => {
    if (!hasFiles(e)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }
  const onDragLeave = (e: React.DragEvent) => {
    if (!hasFiles(e)) return
    setDragDepth((d) => Math.max(0, d - 1))
  }
  const onDrop = (e: React.DragEvent) => {
    if (!hasFiles(e)) return
    e.preventDefault()
    setDragDepth(0)
    void handleImport(Array.from(e.dataTransfer.files))
  }

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
      if (allTabs.length === 0) return
      const base = selectedIndex >= 0 ? selectedIndex : 0
      const next = (base + offset + allTabs.length) % allTabs.length
      setSelectedId(allTabs[next].id)
    },
    [allTabs, selectedIndex],
  )

  const [linkCopied, setLinkCopied] = useState(false)
  useEffect(() => {
    if (!linkCopied) return
    const timer = window.setTimeout(() => setLinkCopied(false), COPIED_FEEDBACK_MS)
    return () => window.clearTimeout(timer)
  }, [linkCopied])

  // Links to the bar under the cursor if one is showing, else the first bar
  // in view. Imports are skipped: their file only exists in this browser.
  const copyLink = useCallback(async () => {
    if (!selected || selected.imported) return
    const bar = (currentBar() ?? topVisibleBar(api, viewportRef.current, layoutMode)) + 1
    window.history.replaceState(null, '', piecePath(selected.id, bar))
    try {
      await navigator.clipboard.writeText(pieceUrl(selected.id, bar))
      setLinkCopied(true)
    } catch {
      // Clipboard can be refused (permissions, insecure context); the address
      // bar already holds the link, so there is still something to copy.
    }
  }, [selected, currentBar, api, layoutMode])

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
        keys: ['c'],
        label: 'c',
        description: 'Copy link to current bar',
        group: 'Collection',
        run: () => void copyLink(),
      },
      {
        keys: ['i'],
        label: 'i',
        description: 'Import Guitar Pro files',
        group: 'Collection',
        run: openImportDialog,
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
      copyLink,
      openImportDialog,
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
    <div
      ref={shellRef}
      className="relative flex h-screen w-screen flex-col overflow-hidden bg-white"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={IMPORT_ACCEPT}
        multiple
        hidden
        aria-hidden="true"
        onChange={(e) => {
          if (e.target.files) void handleImport(Array.from(e.target.files))
          // Reset so picking the same file again still fires onChange.
          e.target.value = ''
        }}
      />

      {dragDepth > 0 && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-white/80 p-6">
          <div className="rounded-xl border-2 border-dashed border-neutral-400 px-10 py-8 text-center">
            <p className="text-base font-medium text-neutral-900">Drop to import</p>
            <p className="mt-1 text-sm text-neutral-500">Guitar Pro files ({IMPORT_ACCEPT})</p>
          </div>
        </div>
      )}

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
        onImport={openImportDialog}
        linkCopied={linkCopied}
        onCopyLink={() => void copyLink()}
      />

      <div className="flex min-h-0 flex-1">
        {sidebarOpen && (
          <TabSidebar
            tabs={allTabs}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onRemove={(id) => void removeImported(id)}
          />
        )}
        <ScoreView
          viewportRef={viewportRef}
          canvasRef={canvasRef}
          isLoading={isLoading}
          error={error ?? importError}
          cursorVisible={cursorVisible}
        />
      </div>

      <TabCommandPalette
        tabs={allTabs}
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onSelect={setSelectedId}
      />
      <ShortcutHelp shortcuts={shortcuts} open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  )
}
