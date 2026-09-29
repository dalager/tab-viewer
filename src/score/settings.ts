import * as alphaTab from '@coderline/alphatab'

export const MIN_SCALE = 0.4
export const MAX_SCALE = 3.0

/**
 * General MIDI nylon acoustic guitar.
 *
 * Roughly a quarter of this collection is written for harpsichord and another
 * tenth for overdriven/distorted guitar; forcing this program plays everything
 * back on the instrument you are actually holding.
 */
export const NYLON_GUITAR_PROGRAM = 24

/** Playback speed, where 1.0 is the score's written tempo. */
export const MIN_SPEED = 0.25
export const MAX_SPEED = 2.0
export const SPEED_STEP = 0.05
export const SPEED_PRESETS = [0.25, 0.5, 0.75, 1.0]

/** Score layouts, in the app's own terms; only the score hooks map them to alphaTab's. */
export type Layout = 'page' | 'horizontal'

/** Layouts cycled by the `l` key. */
export const LAYOUT_CYCLE: Layout[] = ['page', 'horizontal']

export const LAYOUT_LABELS: Record<Layout, string> = {
  page: 'Page',
  horizontal: 'Horizontal',
}

export const LAYOUT_MODES: Record<Layout, alphaTab.LayoutMode> = {
  page: alphaTab.LayoutMode.Page,
  horizontal: alphaTab.LayoutMode.Horizontal,
}

/**
 * How Guitar Pro files are read, for rendering and for import metadata alike.
 *
 * GP3-5 files store Windows-1252, but alphaTab 1.8.4 defaults to utf-8.
 * (The dedicated importer.gp3To5encoding setting is 1.9.0+ only.)
 * Safe here because the collection is 100% gp3/gp4/gp5.
 */
export const IMPORTER_SETTINGS: alphaTab.json.ImporterSettingsJson = {
  encoding: 'windows-1252',
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
    importer: IMPORTER_SETTINGS,
    display: {
      layoutMode: alphaTab.LayoutMode.Page,
      scale: 1.0,
    },
    player: {
      playerMode: alphaTab.PlayerMode.EnabledSynthesizer,
      // Fetched by scripts/fetch-soundfont.mjs. Hosts with a per-file size
      // limit (Cloudflare) point VITE_SOUNDFONT_URL elsewhere; see the README.
      soundFont: import.meta.env.VITE_SOUNDFONT_URL || '/soundfont/default.sf3',
      // The scroll container, so the playback cursor keeps itself in view.
      ...(viewport ? { scrollElement: viewport } : {}),
      scrollOffsetY: -20,
      enableCursor: true,
    },
  }
}
