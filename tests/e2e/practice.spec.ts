// Practice controls, on My Jazz Lick in the bundled book: three bars of 4/4
// at 120 bpm (two seconds each), a lick on the "Guitar" track and chords on
// "Rhythm".

import { expect, type Page, test } from './fixtures'
import { expectOpenPiece, openApp, PIECES, title, toolbar } from './helpers'

const LICK = PIECES[3]

async function openLick(page: Page) {
  await openApp(page, `/p/${LICK.id}`)
  await expectOpenPiece(page, LICK)
  await expect(toolbar(page).getByRole('button', { name: 'Play', exact: true })).toBeEnabled({
    timeout: 45_000,
  })
}

/**
 * Drags across the lick's tab staff from the first beat of bar 1 to a beat
 * in bar `toBar`, as a reader selects a stretch. Positions are measured on
 * the rendered score at the suite's default 1280x720 viewport.
 */
async function selectBars(page: Page, toBar: 1 | 2) {
  const surface = await page.locator('.at-surface').boundingBox()
  if (!surface) throw new Error('score not rendered')
  const y = surface.y + 310
  await page.mouse.move(surface.x + 129, y)
  await page.mouse.down()
  await page.mouse.move(surface.x + (toBar === 1 ? 344 : 456), y, { steps: 5 })
  await page.mouse.up()
}

test('each track can be muted, and a new piece starts with every track playing', async ({ page }) => {
  await openLick(page)
  await toolbar(page).getByRole('button', { name: /^Tracks:/ }).click()
  const muteGuitar = page.getByRole('button', { name: 'Mute Guitar' })
  await expect(muteGuitar).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByRole('button', { name: 'Mute Rhythm' })).toBeVisible()

  await muteGuitar.click()
  const unmuteGuitar = page.getByRole('button', { name: 'Unmute Guitar' })
  await expect(unmuteGuitar).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Mute Rhythm' })).toHaveAttribute('aria-pressed', 'false')

  // Muting only silences the track: it still plays the rest, and still shows.
  await page.keyboard.press('Escape')
  await page.keyboard.press('Space')
  await expect(toolbar(page).getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await page.keyboard.press('s')

  await page.keyboard.press('n')
  await page.keyboard.press('p')
  await expect(title(page)).toHaveText(LICK.title)
  await toolbar(page).getByRole('button', { name: /^Tracks:/ }).click()
  await expect(page.getByRole('button', { name: 'Mute Guitar' })).toHaveAttribute('aria-pressed', 'false')
})

test('r loops the whole piece', async ({ page }) => {
  await openLick(page)
  const loop = toolbar(page).getByRole('button', { name: 'Loop the piece' })
  await expect(loop).toHaveAttribute('aria-pressed', 'false')
  await page.keyboard.press('r')
  await expect(loop).toHaveAttribute('aria-pressed', 'true')

  // Still playing after longer than the six-second piece takes.
  await page.keyboard.press('Space')
  const pause = toolbar(page).getByRole('button', { name: 'Pause', exact: true })
  await expect(pause).toBeVisible()
  await page.waitForTimeout(8_000)
  await expect(pause).toBeVisible()
  await page.keyboard.press('s')

  await loop.click()
  await expect(loop).toHaveAttribute('aria-pressed', 'false')
})

test('dragging across the score selects bars, and Escape plays the whole piece again', async ({ page }) => {
  await openLick(page)
  await selectBars(page, 2)
  const chip = toolbar(page).getByRole('button', { name: 'Bars 1–2 selected: play the whole piece' })
  await expect(chip).toBeVisible()
  await expect(toolbar(page).getByRole('button', { name: 'Loop the selection' })).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(chip).toHaveCount(0)

  await selectBars(page, 2)
  await expect(chip).toBeVisible()
  await chip.click()
  await expect(chip).toHaveCount(0)
})

test('a selected bar plays once, or over and over while looping', async ({ page }) => {
  await openLick(page)
  await selectBars(page, 1)
  await expect(toolbar(page).getByRole('button', { name: 'Bar 1 selected: play the whole piece' })).toBeVisible()
  const play = toolbar(page).getByRole('button', { name: 'Play', exact: true })
  const pause = toolbar(page).getByRole('button', { name: 'Pause', exact: true })

  // Without looping the two-second bar plays once and stops, well before the
  // six seconds the whole piece would take.
  await page.keyboard.press('Space')
  await expect(pause).toBeVisible()
  const started = Date.now()
  await expect(play).toBeVisible({ timeout: 8_000 })
  expect(Date.now() - started).toBeLessThan(4_500)

  // Looping, it is still playing after longer than the whole piece takes.
  await page.keyboard.press('r')
  await page.keyboard.press('Space')
  await expect(pause).toBeVisible()
  await page.waitForTimeout(7_000)
  await expect(pause).toBeVisible()
  await page.keyboard.press('s')
})

test('switching to nylon guitar keeps the selection limiting playback', async ({ page }) => {
  // Rebuilding the MIDI for the new instrument used to drop the range while
  // the selection still showed, so the whole piece played.
  await openLick(page)
  await selectBars(page, 1)
  await page.keyboard.press('g')
  await expect(toolbar(page).getByRole('button', { name: 'Bar 1 selected: play the whole piece' })).toBeVisible()
  const play = toolbar(page).getByRole('button', { name: 'Play', exact: true })
  await expect(play).toBeEnabled()

  await page.keyboard.press('Space')
  await expect(toolbar(page).getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  const started = Date.now()
  await expect(play).toBeVisible({ timeout: 8_000 })
  expect(Date.now() - started).toBeLessThan(4_500)
})
