import { Layers, Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TILE_CLASS } from '@/components/ToolButton'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type { ScoreTrack } from '@/score/tracks'

interface TrackPickerProps {
  tracks: ScoreTrack[]
  /** Selected track indexes. Empty means every track. */
  selected: Set<number>
  onChange: (next: Set<number>) => void
  /** Indexes of silenced tracks; they still show, but do not play. */
  muted: Set<number>
  onToggleMute: (index: number) => void
  /** Shown as a captioned tile, for the toolbar menu. */
  tile?: boolean
}

function MuteButton({ track, muted, onToggle }: { track: ScoreTrack; muted: boolean; onToggle: () => void }) {
  const Icon = muted ? VolumeX : Volume2
  const label = `${muted ? 'Unmute' : 'Mute'} ${track.name}`
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      aria-pressed={muted}
      title={muted ? `${track.name} is muted: play it yourself` : `Mute ${track.name}`}
      className={cn(
        'shrink-0 rounded-md p-1.5 transition-colors hover:text-neutral-900 pointer-coarse:p-2.5',
        muted ? 'text-red-600' : 'text-neutral-400',
      )}
    >
      <Icon className="size-4" />
    </button>
  )
}

/** How many tracks are shown, and the label saying so. */
function describeSelection(tracks: ScoreTrack[], selected: Set<number>) {
  const isAll = selected.size === 0 || selected.size === tracks.length
  const activeCount = selected.size === 0 ? tracks.length : selected.size
  const plural = tracks.length === 1 ? '' : 's'
  const label =
    tracks.length === 0
      ? 'No tracks'
      : isAll
        ? `All ${tracks.length} track${plural}`
        : `${activeCount} of ${tracks.length} tracks`
  // The count shows only when some tracks are hidden, like speed off 100%.
  const count = isAll ? null : `${activeCount}/${tracks.length}`
  return { count, label }
}

/** The selection with one track flipped, or null if that would hide every track. */
function toggled(tracks: ScoreTrack[], selected: Set<number>, index: number): Set<number> | null {
  // An empty set means "all", so materialise it before removing anything.
  const next = selected.size === 0 ? new Set(tracks.map((t) => t.index)) : new Set(selected)
  if (next.has(index)) next.delete(index)
  else next.add(index)
  return next.size === 0 ? null : next
}

export function TrackPicker({
  tracks,
  selected,
  onChange,
  muted,
  onToggleMute,
  tile,
}: TrackPickerProps) {
  const { count, label } = describeSelection(tracks, selected)
  // A tile always has a caption.
  const caption = tile ? (count ?? 'Tracks') : count

  function toggle(index: number) {
    const next = toggled(tracks, selected, index)
    if (next) onChange(next)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={tracks.length === 0}
          aria-label={`Tracks: ${label}`}
          title={`Tracks: ${label} (t)`}
          className={tile ? TILE_CLASS : 'px-1.5 tabular-nums pointer-coarse:h-10'}
        >
          <Layers className="size-4" />
          {caption && <span className="text-xs">{caption}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Tracks
          </span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onChange(new Set())}
            >
              All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onChange(new Set([tracks[0].index]))}
              disabled={tracks.length === 0}
            >
              First only
            </Button>
          </div>
        </div>

        <Separator />

        <ul className="max-h-72 overflow-y-auto p-1">
          {tracks.map((track) => {
            const checked = selected.size === 0 || selected.has(track.index)
            return (
              <li key={track.index} className="flex items-center gap-1">
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-neutral-100 pointer-coarse:py-2.5">
                  <Checkbox checked={checked} onCheckedChange={() => toggle(track.index)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-neutral-900">
                      {track.name}
                    </span>
                    <span className="block truncate text-xs text-neutral-500">
                      {track.summary}
                    </span>
                  </span>
                </label>
                <MuteButton
                  track={track}
                  muted={muted.has(track.index)}
                  onToggle={() => onToggleMute(track.index)}
                />
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
