import type * as alphaTab from '@coderline/alphatab'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'

interface TrackPickerProps {
  tracks: alphaTab.model.Track[]
  /** Selected track indexes. Empty means every track. */
  selected: Set<number>
  onChange: (next: Set<number>) => void
}

/** Short summary line: tuning for fretted staves, MIDI program otherwise. */
function describeTrack(track: alphaTab.model.Track): string {
  const staff = track.staves[0]
  const parts: string[] = []

  if (staff?.isStringed && staff.tuning.length > 0) {
    parts.push(`${staff.tuning.length}-string`)
    const name = staff.tuningName?.trim()
    if (name) parts.push(name)
  } else {
    parts.push(`program ${track.playbackInfo.program}`)
  }

  if (track.staves.length > 1) parts.push(`${track.staves.length} staves`)
  return parts.join(' · ')
}

export function TrackPicker({ tracks, selected, onChange }: TrackPickerProps) {
  const isAll = selected.size === 0 || selected.size === tracks.length
  const activeCount = selected.size === 0 ? tracks.length : selected.size

  const label =
    tracks.length === 0
      ? 'No tracks'
      : isAll
        ? `All ${tracks.length} track${tracks.length === 1 ? '' : 's'}`
        : `${activeCount} of ${tracks.length} tracks`

  function toggle(index: number) {
    // An empty set means "all", so materialise it before removing anything.
    const current = selected.size === 0 ? new Set(tracks.map((t) => t.index)) : new Set(selected)
    if (current.has(index)) current.delete(index)
    else current.add(index)
    // Never leave zero tracks rendered.
    if (current.size === 0) return
    onChange(current)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" disabled={tracks.length === 0} title="Tracks (t)">
          {label}
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
              <li key={track.index}>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-neutral-100">
                  <Checkbox checked={checked} onCheckedChange={() => toggle(track.index)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-neutral-900">
                      {track.name?.trim() || `Track ${track.index + 1}`}
                    </span>
                    <span className="block truncate text-xs text-neutral-500">
                      {describeTrack(track)}
                    </span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
