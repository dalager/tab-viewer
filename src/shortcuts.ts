/**
 * The app's keyboard shortcuts, in the order the help overlay lists them.
 * Pure data: each names an action, and App supplies what the actions do.
 */

import type { Shortcut } from '@/hooks/useHotkeys'

export type ShortcutAction =
  | 'pageDown'
  | 'pageUp'
  | 'halfPageDown'
  | 'halfPageUp'
  | 'scoreStart'
  | 'scoreEnd'
  | 'nextPiece'
  | 'previousPiece'
  | 'openPalette'
  | 'copyLink'
  | 'openSongbooks'
  | 'openExport'
  | 'openImport'
  | 'toggleFullscreen'
  | 'toggleSidebar'
  | 'cycleLayout'
  | 'toggleTracks'
  | 'zoomIn'
  | 'zoomOut'
  | 'resetZoom'
  | 'playPause'
  | 'stop'
  | 'toggleMetronome'
  | 'toggleGuitarOnly'
  | 'slower'
  | 'faster'
  | 'resetSpeed'
  | 'toggleHelp'
  | 'escape'

export type ShortcutActions = Record<ShortcutAction, () => void>

/** Builds one group's shortcuts; `label` defaults to the first key. */
function group(name: string) {
  return (
    keys: string[],
    description: string,
    action: ShortcutAction,
    extra?: Partial<Pick<Shortcut, 'label' | 'withCtrl' | 'allowInOverlay'>>,
  ): Shortcut<ShortcutAction> => ({
    keys,
    label: keys[0],
    description,
    group: name,
    action,
    ...extra,
  })
}

const reading = group('Reading')
const collection = group('Collection')
const view = group('View')
const playback = group('Playback')
const overlays = group('Overlays')

export const SHORTCUTS: readonly Shortcut<ShortcutAction>[] = [
  reading(['PageDown'], 'Next page', 'pageDown'),
  reading(['PageUp'], 'Previous page', 'pageUp'),
  reading(['j'], 'Half page down', 'halfPageDown'),
  reading(['k'], 'Half page up', 'halfPageUp'),
  reading(['Home'], 'Start of score', 'scoreStart'),
  reading(['End'], 'End of score', 'scoreEnd'),

  collection(['n', ']'], 'Next piece', 'nextPiece', { label: 'n / ]' }),
  collection(['p', '['], 'Previous piece', 'previousPiece', { label: 'p / [' }),
  collection(['k'], 'Open search palette', 'openPalette', { label: 'Ctrl+K', withCtrl: true }),
  collection(['/'], 'Open search palette', 'openPalette'),
  collection(['c'], 'Copy link to current bar', 'copyLink'),
  collection(['o'], 'Open songbook', 'openSongbooks'),
  collection(['e'], 'Export pieces as a songbook', 'openExport'),
  collection(['i'], 'Import Guitar Pro files or a .sbk', 'openImport'),

  view(['f'], 'Toggle full screen', 'toggleFullscreen'),
  view(['b'], 'Toggle sidebar', 'toggleSidebar'),
  view(['l'], 'Cycle layout mode', 'cycleLayout'),
  view(['t'], 'All tracks / first track', 'toggleTracks'),
  view(['+', '='], 'Zoom in', 'zoomIn'),
  view(['-'], 'Zoom out', 'zoomOut'),
  view(['0'], 'Reset zoom', 'resetZoom'),

  playback([' '], 'Play / pause', 'playPause', { label: 'Space' }),
  playback(['s'], 'Stop', 'stop'),
  playback(['m'], 'Toggle metronome', 'toggleMetronome'),
  playback(['g'], 'Play everything on nylon guitar', 'toggleGuitarOnly'),
  playback([','], 'Slower', 'slower'),
  playback(['.'], 'Faster', 'faster'),
  playback(['\\'], 'Reset speed to 100%', 'resetSpeed'),

  overlays(['?'], 'Toggle this help', 'toggleHelp', { allowInOverlay: true }),
  overlays(['Escape'], 'Close overlay, else leave full screen', 'escape', {
    label: 'Esc',
    allowInOverlay: true,
  }),
]
