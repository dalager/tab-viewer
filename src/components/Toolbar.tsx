import {
  BookOpen,
  Check,
  CircleHelp,
  FileText,
  Guitar,
  Link,
  Maximize,
  Metronome,
  Minimize,
  MoveHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Repeat,
  Pause,
  Play,
  Search,
  Square,
  Upload,
  ZoomIn,
  ZoomOut,
  X,
} from 'lucide-react'
import { AppIcon } from '@/components/AppIcon'
import { SpeedControl } from '@/components/SpeedControl'
import { Divider, ToolButton } from '@/components/ToolButton'
import { ToolbarMenu } from '@/components/ToolbarMenu'
import { TrackPicker } from '@/components/TrackPicker'
import { Button } from '@/components/ui/button'
import { LAYOUT_LABELS, type Layout } from '@/score/settings'
import type { BarRange } from '@/score/range'
import type { ScoreTrack } from '@/score/tracks'
import type { TabEntry } from '@/types'

export interface ToolbarProps {
  tab: TabEntry | null
  tracks: ScoreTrack[]
  selectedTracks: Set<number>
  onTracksChange: (next: Set<number>) => void
  mutedTracks: Set<number>
  onToggleMute: (index: number) => void
  looping: boolean
  onToggleLooping: () => void
  /** The bars playback is limited to, or null for the whole piece. */
  selection: BarRange | null
  onClearSelection: () => void
  scale: number
  layout: Layout
  isFullscreen: boolean
  /** False where the browser cannot put the app full screen (iPhone). */
  canFullscreen: boolean
  sidebarOpen: boolean
  isPlayerReady: boolean
  isPlaying: boolean
  metronome: boolean
  speed: number
  onSpeedChange: (value: number) => void
  guitarOnly: boolean
  onToggleGuitarOnly: () => void
  onPlayPause: () => void
  onStop: () => void
  onToggleMetronome: () => void
  onToggleSidebar: () => void
  onCycleLayout: () => void
  onZoom: (delta: number) => void
  onResetZoom: () => void
  onToggleFullscreen: () => void
  onOpenPalette: () => void
  onOpenHelp: () => void
  onImport: () => void
  /** Name of the loaded songbook, or null when none is. */
  bookName: string | null
  /** Its description, shown when hovering the name. */
  bookDescription: string | null
  onOpenSongbooks: () => void
  linkCopied: boolean
  /** Why the open piece cannot be linked, or null when it can. */
  linkBlocked: string | null
  onCopyLink: () => void
}

function PieceTitle({ tab }: Pick<ToolbarProps, 'tab'>) {
  return (
    <div className="min-w-0 flex-1 px-1">
      <h1 className="truncate text-sm font-medium text-neutral-900">
        {tab?.title ?? 'Select a piece'}
      </h1>
      {tab && (
        <p className="truncate text-xs text-neutral-500">
          {[tab.artist, tab.ext.toUpperCase()].filter(Boolean).join(' · ')}
        </p>
      )}
    </div>
  )
}

function SongbookButton({
  bookName,
  bookDescription,
  onOpenSongbooks,
}: Pick<ToolbarProps, 'bookName' | 'bookDescription' | 'onOpenSongbooks'>) {
  if (!bookName) {
    return (
      <ToolButton icon={BookOpen} label="Load a songbook" shortcut="o" onClick={onOpenSongbooks} />
    )
  }
  // The name, now that the other controls are icons, cut short before it
  // crowds out the piece's title; the description (if any) is its tooltip.
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onOpenSongbooks}
      title={`${bookDescription ?? bookName}\n\nSwitch or unload songbooks (o)`}
      className="max-w-56"
    >
      <BookOpen className="size-4" />
      <span className="truncate">{bookName}</span>
    </Button>
  )
}

function CopyLinkButton({
  linkCopied,
  linkBlocked,
  onCopyLink,
}: Pick<ToolbarProps, 'linkCopied' | 'linkBlocked' | 'onCopyLink'>) {
  return (
    <ToolButton
      icon={linkCopied ? Check : Link}
      label={linkCopied ? 'Link copied' : 'Copy link'}
      title={linkBlocked ?? 'Copy link to this bar (c)'}
      onClick={onCopyLink}
      disabled={linkBlocked !== null}
    />
  )
}

function ViewControls(
  props: Pick<
    ToolbarProps,
    | 'tracks'
    | 'selectedTracks'
    | 'onTracksChange'
    | 'mutedTracks'
    | 'onToggleMute'
    | 'layout'
    | 'onCycleLayout'
    | 'scale'
    | 'onZoom'
    | 'onResetZoom'
  >,
) {
  return (
    <>
      <TrackPicker
        tracks={props.tracks}
        selected={props.selectedTracks}
        onChange={props.onTracksChange}
        muted={props.mutedTracks}
        onToggleMute={props.onToggleMute}
      />
      <ToolButton
        icon={props.layout === 'horizontal' ? MoveHorizontal : FileText}
        label={`Layout: ${LAYOUT_LABELS[props.layout]}`}
        shortcut="l"
        onClick={props.onCycleLayout}
      />
      <Divider />
      <ToolButton
        icon={ZoomOut}
        label="Zoom out"
        shortcut="-"
        onClick={() => props.onZoom(-0.1)}
      />
      <button
        type="button"
        onClick={props.onResetZoom}
        className="w-11 text-center text-xs tabular-nums text-neutral-600 hover:text-neutral-900"
        title="Reset zoom (0)"
      >
        {Math.round(props.scale * 100)}%
      </button>
      <ToolButton icon={ZoomIn} label="Zoom in" shortcut="+" onClick={() => props.onZoom(0.1)} />
    </>
  )
}

/** "Bars 3–6" while a selection limits playback; clicking it plays the whole piece again. */
function SelectionChip({
  selection,
  onClearSelection,
}: Pick<ToolbarProps, 'selection' | 'onClearSelection'>) {
  if (!selection) return null
  const bars =
    selection.first === selection.last
      ? `Bar ${selection.first + 1}`
      : `Bars ${selection.first + 1}–${selection.last + 1}`
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={onClearSelection}
      aria-label={`${bars} selected: play the whole piece`}
      title={`Playing only ${bars.toLowerCase()}. Click, or press Esc, to play the whole piece.`}
      className="h-7 gap-1 px-2 text-xs tabular-nums"
    >
      {bars}
      <X className="size-3.5" />
    </Button>
  )
}

function PlayPauseButton({
  isPlayerReady,
  isPlaying,
  onPlayPause,
}: Pick<ToolbarProps, 'isPlayerReady' | 'isPlaying' | 'onPlayPause'>) {
  return (
    <ToolButton
      icon={isPlaying ? Pause : Play}
      label={isPlaying ? 'Pause' : 'Play'}
      shortcut="Space"
      onClick={onPlayPause}
      disabled={!isPlayerReady}
    />
  )
}

/** The controls for practising a piece, beyond playing and pausing it. */
function PracticeControls(
  props: Pick<
    ToolbarProps,
    | 'isPlayerReady'
    | 'onStop'
    | 'speed'
    | 'onSpeedChange'
    | 'metronome'
    | 'onToggleMetronome'
    | 'guitarOnly'
    | 'onToggleGuitarOnly'
    | 'looping'
    | 'onToggleLooping'
    | 'selection'
  >,
) {
  const playerOff = !props.isPlayerReady
  return (
    <>
      <ToolButton
        icon={Square}
        label="Stop"
        shortcut="s"
        onClick={props.onStop}
        disabled={playerOff}
      />
      <SpeedControl speed={props.speed} onChange={props.onSpeedChange} disabled={playerOff} />
      <ToolButton
        icon={Metronome}
        label="Metronome"
        shortcut="m"
        onClick={props.onToggleMetronome}
        disabled={playerOff}
        pressed={props.metronome}
      />
      <ToolButton
        icon={Guitar}
        label="Play everything on nylon guitar"
        shortcut="g"
        onClick={props.onToggleGuitarOnly}
        disabled={playerOff}
        pressed={props.guitarOnly}
      />
      <ToolButton
        icon={Repeat}
        label={props.selection ? 'Loop the selection' : 'Loop the piece'}
        shortcut="r"
        onClick={props.onToggleLooping}
        disabled={playerOff}
        pressed={props.looping}
      />
    </>
  )
}

function WindowControls(
  props: Pick<
    ToolbarProps,
    'isFullscreen' | 'canFullscreen' | 'onToggleFullscreen' | 'onOpenHelp'
  >,
) {
  return (
    <>
      {props.canFullscreen && (
        <ToolButton
          icon={props.isFullscreen ? Minimize : Maximize}
          label={props.isFullscreen ? 'Exit full screen' : 'Full screen'}
          shortcut="f"
          onClick={props.onToggleFullscreen}
        />
      )}
      <ToolButton
        icon={CircleHelp}
        label="Keyboard shortcuts"
        shortcut="?"
        onClick={props.onOpenHelp}
      />
    </>
  )
}

/**
 * The list toggle, the piece's title and Play are always shown. Practice
 * controls join them from tablet width (md), and the rest from laptop width
 * (lg); below that, what is left out is in the menu at the end.
 */
export function Toolbar(props: ToolbarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-1 border-b border-neutral-200 bg-white px-2 sm:px-3">
      <AppIcon className="mr-1 hidden size-7 shrink-0 text-neutral-900 sm:block" />

      <ToolButton
        icon={props.sidebarOpen ? PanelLeftClose : PanelLeftOpen}
        label={props.sidebarOpen ? 'Hide list' : 'Show list'}
        shortcut="b"
        onClick={props.onToggleSidebar}
      />

      <div className="hidden sm:contents">
        <Divider />
      </div>

      <PieceTitle tab={props.tab} />

      <div className="hidden items-center gap-1 lg:flex">
        <SongbookButton {...props} />
        <ToolButton icon={Search} label="Search" shortcut="Ctrl+K" onClick={props.onOpenPalette} />
        <ToolButton
          icon={Upload}
          label="Import"
          title="Import Guitar Pro files or a .sbk (i), or drop them anywhere"
          onClick={props.onImport}
        />
        <CopyLinkButton {...props} />
        <Divider />
        <ViewControls {...props} />
      </div>

      <div className="hidden md:contents">
        <Divider />
      </div>
      <PlayPauseButton {...props} />
      <div className="hidden items-center gap-1 md:flex">
        <PracticeControls {...props} />
      </div>
      <SelectionChip selection={props.selection} onClearSelection={props.onClearSelection} />

      <div className="hidden items-center gap-1 lg:flex">
        <Divider />
        <WindowControls {...props} />
      </div>
      <ToolbarMenu {...props} />
    </header>
  )
}
