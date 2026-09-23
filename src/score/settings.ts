import * as alphaTab from '@coderline/alphatab'

export const MIN_SCALE = 0.4
export const MAX_SCALE = 3.0

/** Layout modes cycled by the `l` key. */
export const LAYOUT_CYCLE: alphaTab.LayoutMode[] = [
  alphaTab.LayoutMode.Page,
  alphaTab.LayoutMode.Horizontal,
]

export const LAYOUT_LABELS: Record<number, string> = {
  [alphaTab.LayoutMode.Page]: 'Page',
  [alphaTab.LayoutMode.Horizontal]: 'Horizontal',
}

/**
 * Settings for the single AlphaTabApi instance.
 *
 * fontDirectory and soundFont must be set here: the alphatab-vite plugin copies
 * the assets into public/ but never points alphaTab at them.
 */
export function buildSettings(viewport: HTMLElement | null): alphaTab.json.SettingsJson {
  return {
    core: {
      fontDirectory: '/font/',
      useWorkers: true,
    },
    importer: {
      // GP3-5 files store Windows-1252, but alphaTab 1.8.4 defaults to utf-8.
      // (The dedicated importer.gp3To5encoding setting is 1.9.0+ only.)
      // Safe here because the collection is 100% gp3/gp4/gp5.
      encoding: 'windows-1252',
    },
    display: {
      layoutMode: alphaTab.LayoutMode.Page,
      scale: 1.0,
    },
    player: {
      playerMode: alphaTab.PlayerMode.EnabledSynthesizer,
      soundFont: '/soundfont/sonivox.sf2',
      // The scroll container, so the playback cursor keeps itself in view.
      ...(viewport ? { scrollElement: viewport } : {}),
      scrollOffsetY: -20,
      enableCursor: true,
    },
  }
}
