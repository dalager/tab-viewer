import type { RefObject } from 'react'
import { IMPORT_ACCEPT } from '@/hooks/useImportedTabs'

/** The file picker takes packed songbooks as well as single pieces. */
const OPEN_ACCEPT = `${IMPORT_ACCEPT},.sbk`

interface FilePickerInputProps {
  inputRef: RefObject<HTMLInputElement | null>
  onFiles: (files: File[]) => void
}

/** The hidden file input behind Import and "open a .sbk file"; clicked through `inputRef`. */
export function FilePickerInput({ inputRef, onFiles }: FilePickerInputProps) {
  return (
    <input
      ref={inputRef}
      type="file"
      accept={OPEN_ACCEPT}
      multiple
      hidden
      aria-hidden="true"
      onChange={(e) => {
        if (e.target.files) onFiles(Array.from(e.target.files))
        // Reset so picking the same file again still fires onChange.
        e.target.value = ''
      }}
    />
  )
}
