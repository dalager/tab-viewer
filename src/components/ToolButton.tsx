import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

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

/** On/off styling shared by toolbar buttons and menu tiles. */
function pressedClass(pressed: boolean | undefined) {
  return cn(
    pressed === false && 'text-neutral-400',
    pressed === true && 'bg-neutral-200 text-neutral-900',
  )
}

/** Toolbar buttons grow to a finger's width on touch screens. */
export const TOUCH_SIZE = 'pointer-coarse:size-10'

export function ToolButton({
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
      className={cn(TOUCH_SIZE, pressedClass(pressed))}
    >
      <Icon className="size-4" />
    </Button>
  )
}

/** An icon over a short caption, for the toolbar menu where there are no tooltips. */
export const TILE_CLASS =
  'h-14 w-full flex-col gap-1 px-0 text-xs font-normal tabular-nums [&_svg]:size-5'

interface TileProps extends Omit<ToolButtonProps, 'shortcut' | 'title'> {
  caption: string
}

export function Tile({ icon: Icon, label, caption, onClick, disabled, pressed }: TileProps) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      className={cn(TILE_CLASS, pressedClass(pressed))}
    >
      <Icon />
      {caption}
    </Button>
  )
}

export const Divider = () => <Separator orientation="vertical" className="mx-1 h-6" />
