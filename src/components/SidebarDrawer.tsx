interface SidebarDrawerProps {
  /** Cover the score rather than sit beside it, as on a phone. */
  overlay: boolean
  onClose: () => void
  children: React.ReactNode
}

/** Holds the piece list: beside the score, or over it with a backdrop that closes it. */
export function SidebarDrawer({ overlay, onClose, children }: SidebarDrawerProps) {
  if (!overlay) return children
  return (
    <>
      <button
        type="button"
        aria-label="Hide list"
        onClick={onClose}
        className="absolute inset-0 z-20 bg-neutral-900/30"
      />
      <div className="absolute inset-y-0 left-0 z-30 flex shadow-xl *:max-w-[85vw]">
        {children}
      </div>
    </>
  )
}
