import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Shortcut } from '@/hooks/useHotkeys'

interface ShortcutHelpProps {
  shortcuts: Shortcut[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

const REPO_URL = 'https://github.com/dalager/tab-viewer'

/** Renders the same SHORTCUTS array the handler uses, so the two cannot drift. */
export function ShortcutHelp({ shortcuts, open, onOpenChange }: ShortcutHelpProps) {
  const groups = shortcuts.reduce<Record<string, Shortcut[]>>((acc, s) => {
    ;(acc[s.group] ??= []).push(s)
    return acc
  }, {})

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Press ? to close.</DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[60vh] grid-cols-1 gap-x-10 gap-y-5 overflow-y-auto pr-1 sm:grid-cols-2">
          {Object.entries(groups).map(([group, items]) => (
            <section key={group}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                {group}
              </h3>
              <dl className="space-y-1.5">
                {items.map((s) => (
                  <div key={s.label} className="flex items-baseline gap-3">
                    <dt className="w-24 shrink-0">
                      <kbd className="rounded border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 font-mono text-xs text-neutral-800">
                        {s.label}
                      </kbd>
                    </dt>
                    <dd className="text-sm text-neutral-600">{s.description}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>

        <div className="flex justify-end border-t border-neutral-200 pt-3">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            title="Source on GitHub"
            aria-label="Source on GitHub"
            className="rounded p-1 text-neutral-500 hover:text-neutral-900"
          >
            <svg viewBox="0 0 19 19" className="size-5" aria-hidden="true">
              <use href="/icons.svg#github-icon" />
            </svg>
          </a>
        </div>
      </DialogContent>
    </Dialog>
  )
}
