import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EmptyLibrary } from '@/components/EmptyLibrary'
import { ExportDialog } from '@/components/ExportDialog'
import { FileDropOverlay } from '@/components/FileDropOverlay'
import { FilePickerInput } from '@/components/FilePickerInput'
import { ScoreView } from '@/components/ScoreView'
import { ShortcutHelp } from '@/components/ShortcutHelp'
import { SongbookDialog } from '@/components/SongbookDialog'
import { TabCommandPalette } from '@/components/TabCommandPalette'
import { TabSidebar } from '@/components/TabSidebar'
import { Toolbar } from '@/components/Toolbar'
import { type UseAlphaTab, useAlphaTab } from '@/hooks/useAlphaTab'
import { useCopyLink } from '@/hooks/useCopyLink'
import { useFileDrop } from '@/hooks/useFileDrop'
import { useFileImport } from '@/hooks/useFileImport'
import { useFullscreen } from '@/hooks/useFullscreen'
import { useHotkeys } from '@/hooks/useHotkeys'
import { useImportedTabs } from '@/hooks/useImportedTabs'
import { useOverlay } from '@/hooks/useOverlay'
import { usePieceSelection } from '@/hooks/usePieceSelection'
import { useSongbooks } from '@/hooks/useSongbooks'
import type { Songbook } from '@/lib/songbook'
import { SPEED_STEP } from '@/score/settings'
import { SHORTCUTS, type ShortcutActions } from '@/shortcuts'
import type { TabEntry } from '@/types'

/** Every piece on offer: imports first, so they sit at the top of the sidebar. */
function allPieces(imported: TabEntry[], book: Songbook | null): TabEntry[] {
  return book ? [...imported, ...book.tabs] : imported
}

/** Loads the open piece into the score, starting at its top. */
function useShowPiece(
  score: Pick<UseAlphaTab, 'ready' | 'loadFile'>,
  piece: TabEntry | null,
  viewportRef: React.RefObject<HTMLDivElement | null>,
) {
  const { ready, loadFile } = score
  useEffect(() => {
    if (!piece || !ready) return
    void loadFile(piece.file)
    viewportRef.current?.scrollTo({ top: 0 })
  }, [piece, ready, loadFile, viewportRef])
}

interface ShortcutContext {
  score: UseAlphaTab
  selection: ReturnType<typeof usePieceSelection>
  overlay: ReturnType<typeof useOverlay>
  files: ReturnType<typeof useFileImport>
  fullscreen: ReturnType<typeof useFullscreen>
  copyLink: () => void
  toggleSidebar: () => void
}

interface ToolbarContext extends ShortcutContext {
  book: Songbook | null
  sidebarOpen: boolean
  linkCopied: boolean
}

/** The toolbar's state and handlers; its buttons mirror the shortcuts. */
function toolbarProps(ctx: ToolbarContext): React.ComponentProps<typeof Toolbar> {
  const { score, selection, overlay, files, fullscreen, book } = ctx
  return {
    tab: selection.selected,
    tracks: score.tracks,
    selectedTracks: score.selectedTracks,
    onTracksChange: score.setSelectedTracks,
    scale: score.scale,
    layout: score.layout,
    isFullscreen: fullscreen.isFullscreen,
    sidebarOpen: ctx.sidebarOpen,
    isPlayerReady: score.isPlayerReady,
    isPlaying: score.isPlaying,
    metronome: score.metronome,
    speed: score.speed,
    onSpeedChange: score.setSpeed,
    guitarOnly: score.guitarOnly,
    onToggleGuitarOnly: score.toggleGuitarOnly,
    onPlayPause: score.playPause,
    onStop: score.stop,
    onToggleMetronome: score.toggleMetronome,
    onToggleSidebar: ctx.toggleSidebar,
    onCycleLayout: score.cycleLayout,
    onZoom: score.zoomBy,
    onResetZoom: score.resetZoom,
    onToggleFullscreen: fullscreen.toggle,
    onOpenPalette: overlay.opener('palette'),
    onOpenHelp: overlay.opener('help'),
    onImport: files.pickFiles,
    bookName: book?.name ?? null,
    bookDescription: book?.description ?? null,
    onOpenSongbooks: overlay.opener('songbooks'),
    linkCopied: ctx.linkCopied,
    linkBlocked: selection.linkBlocked,
    onCopyLink: ctx.copyLink,
  }
}

/** What each keyboard shortcut in SHORTCUTS does. */
function shortcutActions(ctx: ShortcutContext): ShortcutActions {
  const { score, selection, overlay, files, fullscreen } = ctx
  return {
    pageDown: () => score.page(1),
    pageUp: () => score.page(-1),
    halfPageDown: () => score.page(1, 'half'),
    halfPageUp: () => score.page(-1, 'half'),
    scoreStart: () => score.scrollToEdge('start'),
    scoreEnd: () => score.scrollToEdge('end'),
    nextPiece: () => selection.goToPiece(1),
    previousPiece: () => selection.goToPiece(-1),
    openPalette: overlay.opener('palette'),
    copyLink: ctx.copyLink,
    openSongbooks: overlay.opener('songbooks'),
    openExport: overlay.opener('export'),
    openImport: files.pickFiles,
    toggleFullscreen: fullscreen.toggle,
    toggleSidebar: ctx.toggleSidebar,
    cycleLayout: score.cycleLayout,
    toggleTracks: score.toggleFirstTrackOnly,
    zoomIn: () => score.zoomBy(0.1),
    zoomOut: () => score.zoomBy(-0.1),
    resetZoom: score.resetZoom,
    playPause: score.playPause,
    stop: score.stop,
    toggleMetronome: score.toggleMetronome,
    toggleGuitarOnly: score.toggleGuitarOnly,
    slower: () => score.nudgeSpeed(-SPEED_STEP),
    faster: () => score.nudgeSpeed(SPEED_STEP),
    resetSpeed: () => score.setSpeed(1),
    toggleHelp: () => overlay.toggle('help'),
    escape: () => (overlay.isOpen ? overlay.close() : void fullscreen.exit()),
  }
}

export default function App() {
  const shellRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const toggleSidebar = () => setSidebarOpen((v) => !v)
  const overlay = useOverlay()

  const imports = useImportedTabs()
  const songbooks = useSongbooks()
  const book = songbooks.active
  const bookName = book ? book.name : null
  const allTabs = useMemo(() => allPieces(imports.imported, book), [imports.imported, book])
  const settled = imports.ready && !songbooks.loading

  const score = useAlphaTab(canvasRef, viewportRef)
  const fullscreen = useFullscreen(shellRef)

  const selection = usePieceSelection({
    tabs: allTabs,
    book,
    settled,
    loadBook: songbooks.load,
    renderVersion: score.renderVersion,
    seekToBar: score.seekToBar,
  })
  const { selected, onBookLoaded, select } = selection

  // Links to the bar under the cursor if one is showing, else the first bar in view.
  const { currentBar, topVisibleBar } = score
  const barInView = useCallback(
    () => (currentBar() ?? topVisibleBar()) + 1,
    [currentBar, topVisibleBar],
  )
  const link = useCopyLink(selection.link, barInView)

  const { close: closeOverlay } = overlay
  const onBookOpened = useCallback(
    (opened: Songbook) => {
      onBookLoaded(opened)
      closeOverlay()
    },
    [onBookLoaded, closeOverlay],
  )
  const files = useFileImport({
    importFiles: imports.importFiles,
    openBookFile: songbooks.openFile,
    onBookOpened,
    select,
  })
  const drop = useFileDrop((dropped) => void files.importAll(dropped))

  useShowPiece(score, selected, viewportRef)

  const copyLink = () => void link.copy()
  const context = { score, selection, overlay, files, fullscreen, copyLink, toggleSidebar }
  const actions = shortcutActions(context)
  useHotkeys(SHORTCUTS, actions, overlay.isOpen)

  return (
    <div
      ref={shellRef}
      className="relative flex h-screen w-screen flex-col overflow-hidden bg-white"
      {...drop.handlers}
    >
      <FilePickerInput inputRef={files.inputRef} onFiles={(f) => void files.importAll(f)} />
      {drop.dragging && <FileDropOverlay />}

      <Toolbar {...toolbarProps({ ...context, book, sidebarOpen, linkCopied: link.copied })} />

      <div className="relative flex min-h-0 flex-1">
        {sidebarOpen && (
          <TabSidebar
            tabs={allTabs}
            bookName={bookName}
            selectedId={selection.selectedId}
            onSelect={select}
            onRemove={(id) => void imports.removeImported(id)}
            onExport={overlay.opener('export')}
          />
        )}
        <ScoreView
          viewportRef={viewportRef}
          canvasRef={canvasRef}
          isLoading={score.isLoading}
          error={score.error ?? imports.error}
          cursorVisible={score.cursorVisible}
        />
        {settled && allTabs.length === 0 && (
          <EmptyLibrary songbooks={songbooks} onLoaded={onBookLoaded} onOpenFile={files.pickFiles} />
        )}
      </div>

      <TabCommandPalette tabs={allTabs} {...overlay.dialogProps('palette')} onSelect={select} />
      <SongbookDialog
        onOpenFile={files.pickFiles}
        songbooks={songbooks}
        {...overlay.dialogProps('songbooks')}
        onLoaded={onBookLoaded}
      />
      <ExportDialog
        {...overlay.dialogProps('export')}
        tabs={allTabs}
        bookName={bookName}
        onSaveAndOpen={files.openBook}
      />
      <ShortcutHelp shortcuts={SHORTCUTS} {...overlay.dialogProps('help')} />
    </div>
  )
}
