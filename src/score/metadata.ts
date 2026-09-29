import * as alphaTab from '@coderline/alphatab'
import { IMPORTER_SETTINGS } from '@/score/settings'

/**
 * Parse a Guitar Pro file once, on the main thread, for the title and artist
 * it carries. Throws if alphaTab cannot read it, so it doubles as validation:
 * a file that fails here would fail in the viewer too.
 */
export function readScoreMetadata(bytes: ArrayBuffer): { title: string; artist: string } {
  const settings = new alphaTab.Settings()
  settings.fillFromJson({ importer: IMPORTER_SETTINGS })
  const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(new Uint8Array(bytes), settings)
  return { title: score.title.trim(), artist: score.artist.trim() }
}
