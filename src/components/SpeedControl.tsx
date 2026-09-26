import { Gauge } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { MAX_SPEED, MIN_SPEED, SPEED_PRESETS, SPEED_STEP } from '@/score/settings'

interface SpeedControlProps {
  speed: number
  onChange: (value: number) => void
  disabled?: boolean
}

const percent = (value: number) => `${Math.round(value * 100)}%`

export function SpeedControl({ speed, onChange, disabled }: SpeedControlProps) {
  const isSlow = speed < 1

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          aria-label={`Playback speed ${percent(speed)}`}
          title={`Playback speed ${percent(speed)} (, and .)`}
          className={cn('px-1.5 tabular-nums', isSlow && 'text-amber-700')}
        >
          <Gauge className="size-4" />
          {speed !== 1 && <span className="text-xs">{percent(speed)}</span>}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-64 p-0">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Playback speed
          </span>
          <span className="text-sm tabular-nums text-neutral-900">{percent(speed)}</span>
        </div>

        <Separator />

        <div className="space-y-3 p-3">
          <input
            type="range"
            min={MIN_SPEED}
            max={MAX_SPEED}
            step={SPEED_STEP}
            value={speed}
            onChange={(e) => onChange(Number(e.target.value))}
            aria-label="Playback speed"
            className="w-full accent-neutral-900"
          />

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 flex-1 px-0 text-xs"
              onClick={() => onChange(speed - SPEED_STEP)}
              disabled={speed <= MIN_SPEED}
            >
              Slower
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 flex-1 px-0 text-xs"
              onClick={() => onChange(speed + SPEED_STEP)}
              disabled={speed >= MAX_SPEED}
            >
              Faster
            </Button>
          </div>

          <div className="flex items-center gap-1">
            {SPEED_PRESETS.map((preset) => (
              <Button
                key={preset}
                variant="ghost"
                size="sm"
                className={cn(
                  'h-7 flex-1 px-0 text-xs tabular-nums',
                  Math.abs(speed - preset) < 0.001 && 'bg-neutral-900 text-white hover:bg-neutral-800 hover:text-white',
                )}
                onClick={() => onChange(preset)}
              >
                {percent(preset)}
              </Button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
