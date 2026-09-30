import {
  BookOpen,
  Check,
  CircleHelp,
  Ellipsis,
  FileText,
  Guitar,
  Link,
  type LucideIcon,
  Maximize,
  Metronome,
  Minimize,
  MoveHorizontal,
  Repeat,
  Search,
  Square,
  Upload,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useState } from 'react'
import { SpeedControl } from '@/components/SpeedControl'
import type { ToolbarProps } from '@/components/Toolbar'
import { Tile, TOUCH_SIZE, TILE_CLASS } from '@/components/ToolButton'
import { TrackPicker } from '@/components/TrackPicker'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { LAYOUT_LABELS } from '@/score/settings'

function Section({ title, className, children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn('border-b border-neutral-200 p-2 last:border-b-0', className)}>
      <h2 className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {title}
      </h2>
      {children}
    </section>
  )
}

const Tiles = ({ children }: { children: React.ReactNode }) => (
  <div className="grid grid-cols-5 gap-1">{children}</div>
)

interface RowProps {
  icon: LucideIcon
  label: string
  /** A second line, e.g. why the row is disabled; touch screens have no tooltips. */
  note?: string | null
  onClick: () => void
  disabled?: boolean
}

function Row({ icon: Icon, label, note, onClick, disabled }: RowProps) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      disabled={disabled}
      className="h-auto min-h-10 w-full justify-start gap-3 px-2 py-2 text-left font-normal whitespace-normal"
    >
      <Icon className="size-4 text-neutral-500" />
      <span className="min-w-0 flex-1">
        <span className="block truncate">{label}</span>
        {note && <span className="block text-xs text-neutral-500">{note}</span>}
      </span>
    </Button>
  )
}

/** Stop, speed, metronome, nylon guitar and loop: inline from tablet width up. */
function PracticeTiles(props: ToolbarProps) {
  const playerOff = !props.isPlayerReady
  return (
    <Section title="Practice" className="md:hidden">
      <Tiles>
        <Tile icon={Square} label="Stop" caption="Stop" onClick={props.onStop} disabled={playerOff} />
        <SpeedControl tile speed={props.speed} onChange={props.onSpeedChange} disabled={playerOff} />
        <Tile
          icon={Metronome}
          label="Metronome"
          caption="Click"
          onClick={props.onToggleMetronome}
          disabled={playerOff}
          pressed={props.metronome}
        />
        <Tile
          icon={Guitar}
          label="Play everything on nylon guitar"
          caption="Nylon"
          onClick={props.onToggleGuitarOnly}
          disabled={playerOff}
          pressed={props.guitarOnly}
        />
        <Tile
          icon={Repeat}
          label={props.selection ? 'Loop the selection' : 'Loop the piece'}
          caption="Loop"
          onClick={props.onToggleLooping}
          disabled={playerOff}
          pressed={props.looping}
        />
      </Tiles>
    </Section>
  )
}

function ViewTiles(props: ToolbarProps) {
  return (
    <Section title="View">
      <Tiles>
        <TrackPicker
          tile
          tracks={props.tracks}
          selected={props.selectedTracks}
          onChange={props.onTracksChange}
          muted={props.mutedTracks}
          onToggleMute={props.onToggleMute}
        />
        <Tile
          icon={props.layout === 'horizontal' ? MoveHorizontal : FileText}
          label={`Layout: ${LAYOUT_LABELS[props.layout]}`}
          caption={LAYOUT_LABELS[props.layout]}
          onClick={props.onCycleLayout}
        />
        <Tile icon={ZoomOut} label="Zoom out" caption="Smaller" onClick={() => props.onZoom(-0.1)} />
        <Button variant="ghost" onClick={props.onResetZoom} aria-label="Reset zoom" className={TILE_CLASS}>
          <span className="text-sm">{Math.round(props.scale * 100)}%</span>
          Reset
        </Button>
        <Tile icon={ZoomIn} label="Zoom in" caption="Larger" onClick={() => props.onZoom(0.1)} />
      </Tiles>
    </Section>
  )
}

/** Songbooks, finding and sharing pieces, and the app itself. Rows that open a dialog close the menu. */
function LibraryRows({ close, ...props }: ToolbarProps & { close: (action: () => void) => () => void }) {
  return (
    <Section title="Library">
      <Row
        icon={BookOpen}
        label={props.bookName ?? 'Load a songbook'}
        note={props.bookName ? 'Switch or unload songbooks' : null}
        onClick={close(props.onOpenSongbooks)}
      />
      <Row icon={Search} label="Find a piece" onClick={close(props.onOpenPalette)} />
      <Row icon={Upload} label="Import files" note="Guitar Pro files or a .sbk" onClick={close(props.onImport)} />
      <Row
        icon={props.linkCopied ? Check : Link}
        label={props.linkCopied ? 'Link copied' : 'Copy link to this bar'}
        note={props.linkBlocked}
        onClick={props.onCopyLink}
        disabled={props.linkBlocked !== null}
      />
      {props.canFullscreen && (
        <Row
          icon={props.isFullscreen ? Minimize : Maximize}
          label={props.isFullscreen ? 'Exit full screen' : 'Full screen'}
          onClick={close(props.onToggleFullscreen)}
        />
      )}
      <Row icon={CircleHelp} label="Keyboard shortcuts" onClick={close(props.onOpenHelp)} />
    </Section>
  )
}

/**
 * Everything the toolbar leaves out below laptop width, captioned since touch
 * screens have no tooltips. Toggles leave it open, to set several at once.
 */
export function ToolbarMenu(props: ToolbarProps) {
  const [open, setOpen] = useState(false)
  const close = (action: () => void) => () => {
    setOpen(false)
    action()
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="More"
          title="More"
          className={cn('lg:hidden', TOUCH_SIZE)}
        >
          <Ellipsis className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={8}
        className="max-h-(--radix-popover-content-available-height) w-[min(22rem,calc(100vw-1rem))] gap-0 overflow-y-auto p-0"
      >
        <PracticeTiles {...props} />
        <ViewTiles {...props} />
        <LibraryRows {...props} close={close} />
      </PopoverContent>
    </Popover>
  )
}
