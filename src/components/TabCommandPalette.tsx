import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import type { TabEntry } from '@/types'

interface TabCommandPaletteProps {
  tabs: TabEntry[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (id: string) => void
}

export function TabCommandPalette({
  tabs,
  open,
  onOpenChange,
  onSelect,
}: TabCommandPaletteProps) {
  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Find a piece"
      description="Search the collection"
    >
      {/* This shadcn build's CommandDialog does not wrap children in Command,
          so cmdk's context has to be provided here. */}
      <Command>
        <CommandInput placeholder="Search pieces…" />
        <CommandList className="max-h-[60vh]">
          <CommandEmpty>No pieces found.</CommandEmpty>
          <CommandGroup heading={`${tabs.length} pieces`}>
            {tabs.map((tab) => (
              <CommandItem
                key={tab.id}
                value={tab.title}
                onSelect={() => {
                  onSelect(tab.id)
                  onOpenChange(false)
                }}
              >
                <span className="flex-1 truncate">{tab.title}</span>
                <span className="shrink-0 text-xs uppercase text-neutral-400">{tab.ext}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
