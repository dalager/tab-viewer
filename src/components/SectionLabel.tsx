/** The small heading over each section of the songbook picker. */
export function SectionLabel({ children }: { children: string }) {
  return (
    <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
      {children}
    </h3>
  )
}
