export interface TabEntry {
  /** ASCII slug, unique within its songbook. Also the URL stem. */
  id: string
  title: string
  artist: string
  /** gp3/gp4/gp5 for the bundled songbook; others may also be gpx or gp. */
  ext: string
  /** URL of the file: http(s) for hosted songbooks, blob: for .sbk pieces and imports. */
  file: string
  /** Set on pieces the user imported; their bytes live in IndexedDB, not under public/. */
  imported?: true
}
