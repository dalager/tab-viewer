import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ExportDialog } from '@/components/ExportDialog'
import { ScoreView } from '@/components/ScoreView'
import { ShortcutHelp } from '@/components/ShortcutHelp'
import { SongbookDialog, SongbookPicker } from '@/components/SongbookDialog'
import { TabCommandPalette } from '@/components/TabCommandPalette'
import { TabSidebar } from '@/components/TabSidebar'
import { Toolbar } from '@/components/Toolbar'
import { useAlphaTab } from '@/hooks/useAlphaTab'
import { useFullscreen } from '@/hooks/useFullscreen'
import { useHotkeys } from '@/hooks/useHotkeys'
import { IMPORT_ACCEPT, useImportedTabs } from '@/hooks/useImportedTabs'
import { useSongbooks } from '@/hooks/useSongbooks'
import { isLocalBook } from '@/lib/localSongbooks'
import { parseLocation, piecePath, pieceUrl } from '@/lib/permalink'
import type { Songbook } from '@/lib/songbook'
import { SPEED_STEP } from '@/score/settings'
import { SHORTCUTS, type ShortcutActions } from '@/shortcuts'

const STORAGE_KEY = 'tab-viewer:selected'

type Overlay = 'palette' | 'help' | 'songbooks' | 'export'
/** The file picker and drop zone take packed songbooks as well as single pieces. */
const OPEN_ACCEPT = `${IMPORT_ACCEPT},.sbk`
const isSongbookFile = (file: File) => file.name.toLowerCase().endsWith('.sbk')
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
    () => parseLocation().id ?? localStorage.getItem(STORAGE_KEY),
  )
  const pendingBar = useRef<PendingBar | null>(pendingBarFrom(window.location))
  const [sidebarOpen, setSidebarOpen] = useState(true)
  // At most one dialog is open at a time; Escape closes it.
  const [overlay, setOverlay] = useState<Overlay | null>(null)
  const openOverlay = (which: Overlay) => () => setOverlay(which)
  const overlayProps = (which: Overlay) => ({
    open: overlay === which,
    onOpenChange: (open: boolean) => setOverlay(open ? which : null),
  })
  const [dragDepth, setDragDepth] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    imported,
    ready: importedReady,
    error: importError,
    importFiles,
    removeImported,
  } = useImportedTabs()

  const songbooks = useSongbooks()
  const { active: book, loading: bookLoading, load: loadBook, openFile: openBookFile } = songbooks

  // Imported pieces first, so they sit at the top of the sidebar.
  const allTabs = useMemo(() => [...imported, ...(book?.tabs ?? [])], [imported, book])

  const {
    ready: scoreReady,
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
    scale,
    zoomBy,
    resetZoom,
    layout,
    cycleLayout,
    tracks,
    selectedTracks,
    setSelectedTracks,
    toggleFirstTrackOnly,
    page,
    scrollToEdge,
    topVisibleBar,
  } = useAlphaTab(canvasRef, viewportRef)
  const { isFullscreen, toggle: toggleFullscreen, exit: exitFullscreen } = useFullscreen(shellRef)

  const selectedIndex = useMemo(
    () => allTabs.findIndex((t) => t.id === selectedId),
    [allTabs, selectedId],
  )
  const selected = selectedIndex >= 0 ? allTabs[selectedIndex] : null
  // Every piece that is not an import belongs to the one loaded songbook.
  const selectedBook = selected && !selected.imported ? (book?.url ?? null) : null
  // Pieces whose file exists only in this browser cannot be shared by link.
  const linkBlocked = !selected
    ? 'No piece is open'
    : selected.imported
      ? 'Imported pieces live only in this browser, so they cannot be linked'
      : selectedBook && isLocalBook(selectedBook)
        ? 'This songbook was opened from a file, so its pieces cannot be linked'
        : null

  // A remembered selection may point at an import that has since been removed,
  // a piece in a songbook that was unloaded, or one not loaded yet. Once imports
  // and the songbook have settled, fall back to the songbook's first piece (else
  // the first import) rather than showing nothing. Adjusted during render, like tracksPiece below, so it
  // settles in the same pass.
  const fallbackId = book?.tabs[0]?.id ?? imported[0]?.id ?? null
  const settled = importedReady && !bookLoading
  if (settled && selectedIndex < 0 && selectedId !== fallbackId) {
    setSelectedId(fallbackId)
  }

  // A freshly loaded songbook stays on the open piece if it has one by that id
  // (a copy of the same book, say), else opens on its first piece. Jumping
  // regardless would load a second piece while the first is still rendering.
  const onBookLoaded = useCallback((loaded: Songbook) => {
    setSelectedId((prev) =>
      loaded.tabs.some((t) => t.id === prev) ? prev : (loaded.tabs[0]?.id ?? null),
    )
  }, [])

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
  // exists is corrected in place instead, so Back does not return to it. With
  // nothing open (no songbook, no imports) the address goes back to "/".
  useEffect(() => {
    if (!settled) return
    if (!selected) {
      if (window.location.pathname !== '/') window.history.replaceState(null, '', '/')
      return
    }
    const current = parseLocation()
    if (current.id === selected.id && current.book === selectedBook) return
    const target = piecePath(selected.id, null, selectedBook)
    const known = current.id !== null && allTabs.some((t) => t.id === current.id)
    if (known) window.history.pushState(null, '', target)
    else window.history.replaceState(null, '', target)
  }, [settled, selected, selectedBook, allTabs])

  // Back/Forward into another songbook's piece has to load that book first.
  const bookUrlRef = useRef(book?.url ?? null)
  useEffect(() => {
    bookUrlRef.current = book?.url ?? null
  }, [book])

  useEffect(() => {
    const onPopState = () => {
      const { id, book: linkedBook } = parseLocation()
      if (!id) return
      const pending = pendingBarFrom(window.location)
      if (linkedBook && linkedBook !== bookUrlRef.current) {
        pendingBar.current = pending
        setSelectedId(id)
        void loadBook(linkedBook)
        return
      }
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
  }, [seekToBar, loadBook])

  useEffect(() => {
    if (!selected || !scoreReady) return
    void loadFile(selected.file)
    viewportRef.current?.scrollTo({ top: 0 })
  }, [selected, scoreReady, loadFile])

  /** Stores a .sbk in this browser, switches to it and closes whatever dialog led there. */
  const openBook = useCallback(
    async (file: File) => {
      const opened = await openBookFile(file)
      if (!opened) return false
      onBookLoaded(opened)
      setOverlay(null)
      return true
    },
    [openBookFile, onBookLoaded],
  )

  // Importing selects the last file added, so it shows up straight away. A
  // .sbk among them is opened as the songbook instead (the last one wins).
  const handleImport = useCallback(
    async (files: File[]) => {
      const bookFile = files.filter(isSongbookFile).at(-1)
      const pieces = files.filter((f) => !isSongbookFile(f))
      const ids = pieces.length > 0 ? await importFiles(pieces) : []
      const opened = bookFile ? await openBook(bookFile) : false
      if (!opened && ids.length > 0) setSelectedId(ids[ids.length - 1])
    },
    [importFiles, openBook],
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
    if (!selected || linkBlocked) return
    const bar = (currentBar() ?? topVisibleBar()) + 1
    window.history.replaceState(null, '', piecePath(selected.id, bar, selectedBook))
    try {
      await navigator.clipboard.writeText(pieceUrl(selected.id, bar, selectedBook))
      setLinkCopied(true)
    } catch {
      // Clipboard can be refused (permissions, insecure context); the address
      // bar already holds the link, so there is still something to copy.
    }
  }, [selected, selectedBook, linkBlocked, currentBar, topVisibleBar])

  const overlayOpen = overlay !== null

  const shortcutActions: ShortcutActions = {
    pageDown: () => page(1),
    pageUp: () => page(-1),
    halfPageDown: () => page(1, 'half'),
    halfPageUp: () => page(-1, 'half'),
    scoreStart: () => scrollToEdge('start'),
    scoreEnd: () => scrollToEdge('end'),
    nextPiece: () => goToPiece(1),
    previousPiece: () => goToPiece(-1),
    openPalette: openOverlay('palette'),
    copyLink: () => void copyLink(),
    openSongbooks: openOverlay('songbooks'),
    openExport: openOverlay('export'),
    openImport: openImportDialog,
    toggleFullscreen,
    toggleSidebar: () => setSidebarOpen((v) => !v),
    cycleLayout,
    toggleTracks: toggleFirstTrackOnly,
    zoomIn: () => zoomBy(0.1),
    zoomOut: () => zoomBy(-0.1),
    resetZoom,
    playPause,
    stop,
    toggleMetronome,
    toggleGuitarOnly,
    slower: () => nudgeSpeed(-SPEED_STEP),
    faster: () => nudgeSpeed(SPEED_STEP),
    resetSpeed: () => setSpeed(1),
    toggleHelp: () => setOverlay((o) => (o === 'help' ? null : 'help')),
    escape: () => (overlay ? setOverlay(null) : void exitFullscreen()),
  }

  useHotkeys(SHORTCUTS, shortcutActions, overlayOpen)

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
        accept={OPEN_ACCEPT}
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
            <p className="mt-1 text-sm text-neutral-500">
              A .sbk songbook, or Guitar Pro files ({IMPORT_ACCEPT})
            </p>
          </div>
        </div>
      )}

      <Toolbar
        tab={selected}
        tracks={tracks}
        selectedTracks={selectedTracks}
        onTracksChange={setSelectedTracks}
        scale={scale}
        layout={layout}
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
        onOpenPalette={openOverlay('palette')}
        onOpenHelp={openOverlay('help')}
        onImport={openImportDialog}
        bookName={book?.name ?? null}
        bookDescription={book?.description ?? null}
        onOpenSongbooks={openOverlay('songbooks')}
        linkCopied={linkCopied}
        linkBlocked={linkBlocked}
        onCopyLink={() => void copyLink()}
      />

      <div className="relative flex min-h-0 flex-1">
        {sidebarOpen && (
          <TabSidebar
            tabs={allTabs}
            bookName={book?.name ?? null}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onRemove={(id) => void removeImported(id)}
            onExport={openOverlay('export')}
          />
        )}
        <ScoreView
          viewportRef={viewportRef}
          canvasRef={canvasRef}
          isLoading={isLoading}
          error={error ?? importError}
          cursorVisible={cursorVisible}
        />
        {settled && allTabs.length === 0 && (
          <div className="absolute inset-0 z-20 flex items-start justify-center overflow-y-auto bg-white p-6 sm:pt-16">
            <div className="w-full max-w-lg">
              <h2 className="text-lg font-semibold text-neutral-900">Load a songbook</h2>
              <p className="mt-1 mb-6 text-sm text-neutral-500">
                Paste the URL of a songbook, pick one below, or drop a .sbk songbook or Guitar
                Pro files anywhere.
              </p>
              <SongbookPicker
                songbooks={songbooks}
                onLoaded={onBookLoaded}
                onOpenFile={openImportDialog}
              />
            </div>
          </div>
        )}
      </div>

      <TabCommandPalette
        tabs={allTabs}
        {...overlayProps('palette')}
        onSelect={setSelectedId}
      />
      <SongbookDialog
        onOpenFile={openImportDialog}
        songbooks={songbooks}
        {...overlayProps('songbooks')}
        onLoaded={onBookLoaded}
      />
      <ExportDialog
        {...overlayProps('export')}
        tabs={allTabs}
        bookName={book?.name ?? null}
        onSaveAndOpen={openBook}
      />
      <ShortcutHelp shortcuts={SHORTCUTS} {...overlayProps('help')} />
    </div>
  )
}
