import { IMPORT_ACCEPT } from '@/hooks/useImportedTabs'

/** Shown over the whole app while files are dragged across it. */
export function FileDropOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-white/80 p-6">
      <div className="rounded-xl border-2 border-dashed border-neutral-400 px-10 py-8 text-center">
        <p className="text-base font-medium text-neutral-900">Drop to import</p>
        <p className="mt-1 text-sm text-neutral-500">
          A .sbk songbook, or Guitar Pro files ({IMPORT_ACCEPT})
        </p>
      </div>
    </div>
  )
}
