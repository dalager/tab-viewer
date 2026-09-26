import * as alphaTab from '@coderline/alphatab'
import {
  BookOpen,
  Check,
  CircleHelp,
  FileText,
  Guitar,
  Link,
  type LucideIcon,
  Maximize,
  Metronome,
  Minimize,
  MoveHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Pause,
  Play,
  Search,
  Square,
  Upload,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { AppIcon } from '@/components/AppIcon'
import { SpeedControl } from '@/components/SpeedControl'
import { TrackPicker } from '@/components/TrackPicker'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { LAYOUT_LABELS } from '@/score/settings'
import type { TabEntry } from '@/types'

interface ToolbarProps {
  tab: TabEntry | null
  tracks: alphaTab.model.Track[]
  selectedTracks: Set<number>
  onTracksChange: (next: Set<number>) => void
  scale: number
  layoutMode: alphaTab.LayoutMode
  isFullscreen: boolean
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

interface ToolButtonProps {
  icon: LucideIcon
  /** Accessible name, and the start of the tooltip. */
  label: string
  /** Key hint appended to the tooltip, e.g. "Space". */
  shortcut?: string
  /** Replaces the whole tooltip, e.g. to say why the button is disabled. */
  title?: string
  onClick: () => void
  disabled?: boolean
  /** For on/off toggles: shown pressed, and announced as such. */
  pressed?: boolean
}

function ToolButton({
  icon: Icon,
  label,
  shortcut,
  title,
  onClick,
  disabled,
  pressed,
}: ToolButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      title={title ?? (shortcut ? `${label} (${shortcut})` : label)}
      className={cn(
        pressed === false && 'text-neutral-400',
        pressed === true && 'bg-neutral-200 text-neutral-900',
      )}
    >
      <Icon className="size-4" />
    </Button>
  )
}

export function Toolbar(props: ToolbarProps) {
  const { tab, tracks, scale, layoutMode } = props
  const horizontal = layoutMode === alphaTab.LayoutMode.Horizontal
  const playerOff = !props.isPlayerReady

  return (
    <header className="flex h-14 shrink-0 items-center gap-1 border-b border-neutral-200 bg-white px-3">
      <AppIcon className="mr-1 size-7 shrink-0 text-neutral-900" />

      <ToolButton
        icon={props.sidebarOpen ? PanelLeftClose : PanelLeftOpen}
        label={props.sidebarOpen ? 'Hide list' : 'Show list'}
        shortcut="b"
        onClick={props.onToggleSidebar}
      />

      <Separator orientation="vertical" className="mx-1 h-6" />

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

      {props.bookName ? (
        // The full name, now that the other controls are icons; the
        // description (if any) is its tooltip.
        <Button
          variant="ghost"
          size="sm"
          onClick={props.onOpenSongbooks}
          title={`${props.bookDescription ?? props.bookName}\n\nSwitch or unload songbooks (o)`}
          className="shrink-0"
        >
          <BookOpen className="size-4" />
          {props.bookName}
        </Button>
      ) : (
        <ToolButton
          icon={BookOpen}
          label="Load a songbook"
          shortcut="o"
          onClick={props.onOpenSongbooks}
        />
      )}
      <ToolButton icon={Search} label="Search" shortcut="Ctrl+K" onClick={props.onOpenPalette} />
      <ToolButton
        icon={Upload}
        label="Import"
        title="Import Guitar Pro files or a .sbk (i), or drop them anywhere"
        onClick={props.onImport}
      />
      <ToolButton
        icon={props.linkCopied ? Check : Link}
        label={props.linkCopied ? 'Link copied' : 'Copy link'}
        title={props.linkBlocked ?? 'Copy link to this bar (c)'}
        onClick={props.onCopyLink}
        disabled={props.linkBlocked !== null}
      />

      <Separator orientation="vertical" className="mx-1 h-6" />

      <TrackPicker
        tracks={tracks}
        selected={props.selectedTracks}
        onChange={props.onTracksChange}
      />
      <ToolButton
        icon={horizontal ? MoveHorizontal : FileText}
        label={`Layout: ${LAYOUT_LABELS[layoutMode] ?? 'Page'}`}
        shortcut="l"
        onClick={props.onCycleLayout}
      />

      <Separator orientation="vertical" className="mx-1 h-6" />

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
        {Math.round(scale * 100)}%
      </button>
      <ToolButton icon={ZoomIn} label="Zoom in" shortcut="+" onClick={() => props.onZoom(0.1)} />

      <Separator orientation="vertical" className="mx-1 h-6" />

      <ToolButton
        icon={props.isPlaying ? Pause : Play}
        label={props.isPlaying ? 'Pause' : 'Play'}
        shortcut="Space"
        onClick={props.onPlayPause}
        disabled={playerOff}
      />
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

      <Separator orientation="vertical" className="mx-1 h-6" />

      <ToolButton
        icon={props.isFullscreen ? Minimize : Maximize}
        label={props.isFullscreen ? 'Exit full screen' : 'Full screen'}
        shortcut="f"
        onClick={props.onToggleFullscreen}
      />
      <ToolButton
        icon={CircleHelp}
        label="Keyboard shortcuts"
        shortcut="?"
        onClick={props.onOpenHelp}
      />
    </header>
  )
}
