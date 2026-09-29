import type { PieceRef } from '@/lib/pieces'

export interface TabEntry extends PieceRef {
  /** ASCII slug, unique within its songbook (`book`). Also the URL stem. */
  id: string
  title: string
  artist: string
  /** gp3/gp4/gp5 for the bundled songbook; others may also be gpx or gp. */
  ext: string
  /** URL of the file: http(s) for hosted songbooks, blob: for .sbk pieces and imports. */
  file: string
}
