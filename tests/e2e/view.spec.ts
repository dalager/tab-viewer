// Moving through a score and changing how it is shown: the paging keys, the
// zoom and track controls, playback speed, and full screen.

import { expect, type Page, test } from './fixtures'
import { expectOpenPiece, expectScoreRendered, openApp, PIECES, toolbar } from './helpers'

const [, , PARTITA, LICK] = PIECES

const viewport = (page: Page) => page.locator('.at-viewport')
const scrollTop = (page: Page) => viewport(page).evaluate((v) => v.scrollTop)
const scrollLeft = (page: Page) => viewport(page).evaluate((v) => v.scrollLeft)
const maxScrollTop = (page: Page) => viewport(page).evaluate((v) => v.scrollHeight - v.clientHeight)

/** Waits out the viewport's smooth scrolling: two reads a moment apart agree. */
async function settled(page: Page) {
  const position = () => viewport(page).evaluate((v) => [v.scrollLeft, v.scrollTop].join())
  await expect
    .poll(async () => {
      const before = await position()
      await page.waitForTimeout(150)
      return before === (await position())
    })
    .toBe(true)
}

async function openPiece(page: Page, piece: (typeof PIECES)[number]) {
  await openApp(page, `/p/${piece.id}`)
  await expectOpenPiece(page, piece)
  await expectScoreRendered(page)
}

async function waitForPlayer(page: Page) {
  await expect(toolbar(page).getByRole('button', { name: 'Play', exact: true })).toBeEnabled({
    timeout: 45_000,
  })
}

test('PageDown, PageUp, j, k, Home and End move through a long score', async ({ page }) => {
  await openPiece(page, PARTITA)
  await page.keyboard.press('Home')
  await settled(page)
  expect(await scrollTop(page)).toBe(0)

  await page.keyboard.press('PageDown')
  await settled(page)
  const afterPage = await scrollTop(page)
  expect(afterPage).toBeGreaterThan(0)

  await page.keyboard.press('j')
  await settled(page)
  const afterHalf = await scrollTop(page)
  expect(afterHalf).toBeGreaterThan(afterPage)
  await page.keyboard.press('k')
  await settled(page)
  expect(await scrollTop(page)).toBeLessThan(afterHalf)

  // Paging snaps to staff systems, so back up lands on the first one, near the top.
  await page.keyboard.press('PageUp')
  await settled(page)
  expect(await scrollTop(page)).toBeLessThan(afterPage)

  await page.keyboard.press('End')
  const bottom = await maxScrollTop(page)
  await expect.poll(() => scrollTop(page)).toBeGreaterThanOrEqual(bottom - 1)
  await page.keyboard.press('Home')
  await expect.poll(() => scrollTop(page)).toBe(0)
})

test('in the horizontal layout, paging scrolls sideways and links the bar in view', async ({ page }) => {
  await openPiece(page, PARTITA)
  await page.keyboard.press('l')
  await expect(toolbar(page).getByRole('button', { name: 'Layout: Horizontal' })).toBeVisible()
  // Re-rendered as one long row: far wider than the window.
  await expect
    .poll(() => viewport(page).evaluate((v) => v.scrollWidth / v.clientWidth))
    .toBeGreaterThan(5)

  await page.keyboard.press('PageDown')
  await settled(page)
  expect(await scrollLeft(page)).toBeGreaterThan(0)
  expect(await scrollTop(page)).toBe(0)

  // End goes to the last bar, sideways; Home back to the first.
  await page.keyboard.press('End')
  await settled(page)
  const right = await viewport(page).evaluate((v) => v.scrollWidth - v.clientWidth)
  expect(await scrollLeft(page)).toBeGreaterThanOrEqual(right - 1)
  await page.keyboard.press('Home')
  await settled(page)
  expect(await scrollLeft(page)).toBe(0)
  await page.keyboard.press('PageDown')
  await settled(page)

  // Nothing is playing, so the link names the first bar in view: not bar 1.
  await page.keyboard.press('c')
  await expect(page).toHaveURL(/&bar=(\d+)$/)
  const bar = Number(new URL(page.url()).searchParams.get('bar'))
  expect(bar).toBeGreaterThan(1)
})

test('the zoom buttons step the scale, and clicking it resets it', async ({ page }) => {
  await openApp(page)
  const zoom = toolbar(page).getByRole('button', { name: /^\d+%$/ })
  await toolbar(page).getByRole('button', { name: 'Zoom out' }).click()
  await expect(zoom).toHaveText('90%')
  await zoom.click()
  await expect(zoom).toHaveText('100%')
})

test('the track list shows and hides tracks, but never all of them', async ({ page }) => {
  await openPiece(page, LICK)
  const tracksButton = toolbar(page).getByRole('button', { name: /^Tracks:/ })
  await expect(tracksButton).toHaveAccessibleName('Tracks: All 2 tracks')

  // t switches between the first track only and every track.
  await page.keyboard.press('t')
  await expect(tracksButton).toHaveAccessibleName('Tracks: 1 of 2 tracks')
  await expect(tracksButton).toHaveText('1/2')
  await page.keyboard.press('t')
  await expect(tracksButton).toHaveAccessibleName('Tracks: All 2 tracks')

  await tracksButton.click()
  const [guitar, rhythm] = await page.getByRole('checkbox').all()
  await rhythm.click()
  await expect(rhythm).not.toBeChecked()
  await expect(tracksButton).toHaveAccessibleName('Tracks: 1 of 2 tracks')

  // Hiding the last track shown would leave an empty score, so it is refused.
  await guitar.click()
  await expect(guitar).toBeChecked()

  await rhythm.click()
  await expect(tracksButton).toHaveAccessibleName('Tracks: All 2 tracks')
  await page.getByRole('button', { name: 'First only' }).click()
  await expect(rhythm).not.toBeChecked()
  await page.getByRole('button', { name: 'All', exact: true }).click()
  await expect(rhythm).toBeChecked()
})

test('a muted track can be unmuted again', async ({ page }) => {
  await openPiece(page, LICK)
  await toolbar(page).getByRole('button', { name: /^Tracks:/ }).click()
  await page.getByRole('button', { name: 'Mute Guitar' }).click()
  await page.getByRole('button', { name: 'Unmute Guitar' }).click()
  await expect(page.getByRole('button', { name: 'Mute Guitar' })).toHaveAttribute('aria-pressed', 'false')
})

test('the speed popover has a slider, slower and faster, and presets', async ({ page }) => {
  await openApp(page)
  await waitForPlayer(page)
  await toolbar(page).getByRole('button', { name: 'Playback speed 100%' }).click()
  const popover = page.getByRole('dialog')

  await popover.getByRole('slider', { name: 'Playback speed' }).fill('0.5')
  await expect(toolbar(page).getByRole('button', { name: 'Playback speed 50%' })).toBeVisible()
  await popover.getByRole('button', { name: 'Faster' }).click()
  await expect(toolbar(page).getByRole('button', { name: 'Playback speed 55%' })).toBeVisible()
  await popover.getByRole('button', { name: 'Slower' }).click()
  await popover.getByRole('button', { name: 'Slower' }).click()
  await expect(toolbar(page).getByRole('button', { name: 'Playback speed 45%' })).toBeVisible()
  await popover.getByRole('button', { name: '100%' }).click()
  await expect(toolbar(page).getByRole('button', { name: 'Playback speed 100%' })).toBeVisible()
})

test('f and the toolbar button put the app full screen and back', async ({ page }) => {
  await openApp(page)
  const isFullscreen = () => page.evaluate(() => document.fullscreenElement !== null)

  await page.keyboard.press('f')
  await expect.poll(isFullscreen).toBe(true)
  const exit = toolbar(page).getByRole('button', { name: 'Exit full screen' })
  await expect(exit).toBeVisible()
  await exit.click()
  await expect.poll(isFullscreen).toBe(false)

  await toolbar(page).getByRole('button', { name: 'Full screen' }).click()
  await expect.poll(isFullscreen).toBe(true)
  await page.keyboard.press('f')
  await expect.poll(isFullscreen).toBe(false)
})

test('dialogs and popovers can be used in full screen', async ({ page }) => {
  await openPiece(page, LICK)
  await page.keyboard.press('f')
  await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null)).toBe(true)

  // They open outside the app's own element, so the whole page must be full screen.
  await toolbar(page).getByRole('button', { name: /^Tracks:/ }).click()
  await page.getByRole('button', { name: 'First only' }).click()
  await expect(toolbar(page).getByRole('button', { name: /^Tracks:/ })).toHaveAccessibleName(
    'Tracks: 1 of 2 tracks',
  )
  await page.keyboard.press('Escape')
  await page.keyboard.press('/')
  const palette = page.getByRole('dialog', { name: 'Find a piece' })
  await palette.getByRole('option', { name: PIECES[1].title }).click()
  await expectOpenPiece(page, PIECES[1])
})

test('nylon guitar stays on for the next piece, and turns off again', async ({ page }) => {
  await openApp(page)
  await waitForPlayer(page)
  const nylon = toolbar(page).getByRole('button', { name: 'Play everything on nylon guitar' })
  await page.keyboard.press('g')
  await expect(nylon).toHaveAttribute('aria-pressed', 'true')

  await page.keyboard.press('n')
  await expectScoreRendered(page)
  await waitForPlayer(page)
  await expect(nylon).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('g')
  await expect(nylon).toHaveAttribute('aria-pressed', 'false')
})
