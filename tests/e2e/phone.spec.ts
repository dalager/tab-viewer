// The app on a phone: a toolbar that fits, the list as a drawer over the
// score, and the controls left out of the toolbar gathered in its menu.

import { expect, type Page, test } from '@playwright/test'
import {
  BOOK_NAME,
  expectOpenPiece,
  expectScoreRendered,
  PIECES,
  sidebar,
  sidebarRow,
  title,
  toolbar,
} from './helpers'

const [ARPEGGIOS, CELLO] = PIECES

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

/** openApp waits for the songbook button, which a phone keeps in the menu. */
async function openOnPhone(page: Page) {
  await page.goto('/')
  await expectScoreRendered(page)
  await expectOpenPiece(page, ARPEGGIOS)
}

async function openMenu(page: Page) {
  await toolbar(page).getByRole('button', { name: 'More' }).click()
  return page.getByRole('dialog')
}

test('the toolbar fits the screen, and the list starts closed', async ({ page }) => {
  await openOnPhone(page)
  const header = await toolbar(page).evaluate((h) => ({ scroll: h.scrollWidth, client: h.clientWidth }))
  expect(header.scroll).toBeLessThanOrEqual(header.client)
  await expect(title(page)).toBeVisible()
  await expect(toolbar(page).getByRole('button', { name: 'Play' })).toBeVisible()
  await expect(toolbar(page).getByRole('button', { name: BOOK_NAME })).toBeHidden()
  await expect(sidebar(page)).toHaveCount(0)
})

test('the list covers the score, and closes once a piece is picked', async ({ page }) => {
  await openOnPhone(page)
  await toolbar(page).getByRole('button', { name: 'Show list' }).click()
  await sidebarRow(page, CELLO.title).click()
  await expectOpenPiece(page, CELLO)
  await expect(sidebar(page)).toHaveCount(0)

  // Tapping the dimmed score beside the list closes it too.
  await toolbar(page).getByRole('button', { name: 'Show list' }).click()
  await expect(sidebar(page)).toBeVisible()
  await page.mouse.click(370, 400)
  await expect(sidebar(page)).toHaveCount(0)
})

test('the menu holds the controls the toolbar leaves out', async ({ page }) => {
  await openOnPhone(page)
  const menu = await openMenu(page)
  for (const name of ['Stop', 'Metronome', 'Loop the piece', 'Zoom in', 'Keyboard shortcuts']) {
    await expect(menu.getByRole('button', { name })).toBeVisible()
  }

  // Toggles leave the menu open.
  await menu.getByRole('button', { name: 'Layout: Page' }).click()
  await expect(menu.getByRole('button', { name: 'Layout: Horizontal' })).toBeVisible()

  // Rows that open a dialog close the menu first.
  await menu.getByRole('button', { name: new RegExp(BOOK_NAME) }).click()
  await expect(page.getByRole('dialog', { name: 'Songbooks' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Layout: Horizontal' })).toHaveCount(0)
})

test('the track list opens from the menu', async ({ page }) => {
  await openOnPhone(page)
  const menu = await openMenu(page)
  await menu.getByRole('button', { name: /^Tracks:/ }).click()
  await expect(page.getByRole('button', { name: 'First only' })).toBeVisible()
})
