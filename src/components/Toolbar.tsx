import type * as alphaTab from '@coderline/alphatab'
import { SpeedControl } from '@/components/SpeedControl'
import { TrackPicker } from '@/components/TrackPicker'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
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
}

export function Toolbar(props: ToolbarProps) {
  const { tab, tracks, scale, layoutMode } = props

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-neutral-200 bg-white px-3">
      <Button variant="ghost" size="sm" onClick={props.onToggleSidebar} title="Toggle sidebar (b)">
        {props.sidebarOpen ? 'Hide list' : 'Show list'}
      </Button>

      <Separator orientation="vertical" className="h-6" />

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-sm font-medium text-neutral-900">
          {tab?.title ?? 'Select a piece'}
        </h1>
        {tab && (
          <p className="truncate text-xs text-neutral-500">
            {tab.artist} · {tab.ext.toUpperCase()}
          </p>
        )}
      </div>

      <Button variant="ghost" size="sm" onClick={props.onOpenPalette} title="Search (Ctrl+K)">
        Search
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={props.onImport}
        title="Import Guitar Pro files (i), or drop them anywhere"
      >
        Import
      </Button>

      <Separator orientation="vertical" className="h-6" />

      <TrackPicker
        tracks={tracks}
        selected={props.selectedTracks}
        onChange={props.onTracksChange}
      />

      <Button variant="ghost" size="sm" onClick={props.onCycleLayout} title="Cycle layout (l)">
        {LAYOUT_LABELS[layoutMode] ?? 'Page'}
      </Button>

      <Separator orientation="vertical" className="h-6" />

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={() => props.onZoom(-0.1)} title="Zoom out (-)">
          −
        </Button>
        <button
          type="button"
          onClick={props.onResetZoom}
          className="w-12 text-center text-xs tabular-nums text-neutral-600 hover:text-neutral-900"
          title="Reset zoom (0)"
        >
          {Math.round(scale * 100)}%
        </button>
        <Button variant="ghost" size="sm" onClick={() => props.onZoom(0.1)} title="Zoom in (+)">
          +
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6" />

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={props.onPlayPause}
          disabled={!props.isPlayerReady}
          title="Play / pause (Space)"
        >
          {props.isPlaying ? 'Pause' : 'Play'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={props.onStop}
          disabled={!props.isPlayerReady}
          title="Stop (s)"
        >
          Stop
        </Button>
        <SpeedControl
          speed={props.speed}
          onChange={props.onSpeedChange}
          disabled={!props.isPlayerReady}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={props.onToggleMetronome}
          disabled={!props.isPlayerReady}
          title="Metronome (m)"
          className={props.metronome ? 'text-neutral-900' : 'text-neutral-400'}
        >
          Metronome
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={props.onToggleGuitarOnly}
          disabled={!props.isPlayerReady}
          title="Play everything on nylon guitar (g)"
          className={props.guitarOnly ? 'text-neutral-900' : 'text-neutral-400'}
        >
          As guitar
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6" />

      <Button
        variant="ghost"
        size="sm"
        onClick={props.onToggleFullscreen}
        title="Toggle fullscreen (f)"
      >
        {props.isFullscreen ? 'Exit full screen' : 'Full screen'}
      </Button>

      <Button variant="ghost" size="sm" onClick={props.onOpenHelp} title="Shortcuts (?)">
        ?
      </Button>
    </header>
  )
}
