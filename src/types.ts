export interface TabEntry {
  /** ASCII slug, unique across the collection. Also the URL stem. */
  id: string
  title: string
  artist: string
  songId: string
  /** gp3/gp4/gp5 for the bundled collection; imports may also be gpx or gp. */
  ext: string
  /** Path under public/, e.g. "/tabs/air-on-the-g-string.gp5". Empty for imports. */
  file: string
  sourceUrl: string
  /** Set on pieces the user imported; their bytes live in IndexedDB, not under public/. */
  imported?: true
}
