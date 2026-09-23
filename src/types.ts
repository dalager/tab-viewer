export interface TabEntry {
  /** ASCII slug, unique across the collection. Also the URL stem. */
  id: string
  title: string
  artist: string
  songId: string
  ext: 'gp3' | 'gp4' | 'gp5'
  /** Path under public/, e.g. "/tabs/air-on-the-g-string.gp5" */
  file: string
  sourceUrl: string
}
