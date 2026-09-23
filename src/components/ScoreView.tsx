import type { RefObject } from 'react'
import { cn } from '@/lib/utils'

interface ScoreViewProps {
  viewportRef: RefObject<HTMLDivElement | null>
  canvasRef: RefObject<HTMLDivElement | null>
  isLoading: boolean
  error: string | null
  className?: string
}

/**
 * .at-viewport is the scroll container: paging math and (phase 5)
 * player.scrollElement both operate on it.
 */
export function ScoreView({
  viewportRef,
  canvasRef,
  isLoading,
  error,
  className,
}: ScoreViewProps) {
  return (
    <div className={cn('at-wrap relative flex-1 bg-white', className)}>
      {isLoading && (
        <div className="absolute inset-x-0 top-0 z-10 h-0.5 animate-pulse bg-neutral-900" />
      )}

      {error && (
        <div className="absolute inset-x-0 top-0 z-10 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          Could not render this piece: {error}
        </div>
      )}

      <div ref={viewportRef} className="at-viewport h-full w-full" tabIndex={-1}>
        <div ref={canvasRef} className="at-canvas" />
      </div>
    </div>
  )
}
