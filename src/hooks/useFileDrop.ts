import { useState } from 'react'

const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes('Files')

/**
 * Drag-and-drop of files anywhere on an element. dragenter/dragleave fire for
 * every child crossed, so a depth counter tells a real leave from a nested one.
 */
export function useFileDrop(onFiles: (files: File[]) => void) {
  const [depth, setDepth] = useState(0)

  const handlers = {
    onDragEnter: (e: React.DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      setDepth((d) => d + 1)
    },
    onDragOver: (e: React.DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    },
    onDragLeave: (e: React.DragEvent) => {
      if (hasFiles(e)) setDepth((d) => Math.max(0, d - 1))
    },
    onDrop: (e: React.DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      setDepth(0)
      onFiles(Array.from(e.dataTransfer.files))
    },
  }

  return { dragging: depth > 0, handlers }
}
