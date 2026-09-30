// Loading, unloading, forgetting and downloading songbooks.

import { expect, test } from './fixtures'
import {
  BOOK_NAME,
  BOOK_URL,
  expectOpenPiece,
  openApp,
  PIECES,
  readManifest,
  sidebar,
  title,
  toolbar,
} from './helpers'

const [ARPEGGIOS] = PIECES

test('o shows the loaded songbook, and Unload empties the app', async ({ page }) => {
  await openApp(page)
  await page.keyboard.press('o')
  const dialog = page.getByRole('dialog', { name: 'Songbooks' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText(`4 pieces · ${new URL(BOOK_URL, page.url()).href}`)).toBeVisible()

  await dialog.getByRole('button', { name: 'Unload' }).click()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)

  await expect(title(page)).toHaveText('Select a piece')
  await expect(page.getByRole('heading', { name: 'Load a songbook' })).toBeVisible()
  await expect(page).toHaveURL(/\/$/)
  await expect(toolbar(page).getByRole('button', { name: 'Load a songbook' })).toBeVisible()

  // An unloaded book stays unloaded on the next visit.
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Load a songbook' })).toBeVisible()

  // But it is still remembered, one click away.
  await page.getByText('Previously loaded').waitFor()
  await page.getByRole('button', { name: new RegExp(`^${BOOK_NAME}`) }).click()
  await expectOpenPiece(page, ARPEGGIOS)
})

test('a forgotten book returns to the suggestions and can be loaded by URL', async ({ page }) => {
  await openApp(page)
  await toolbar(page).getByRole('button', { name: BOOK_NAME }).click()
  const dialog = page.getByRole('dialog', { name: 'Songbooks' })
  await expect(dialog.getByText('Suggested')).toHaveCount(0)

  await dialog.getByRole('button', { name: `Forget ${BOOK_NAME}` }).click()
  await expect(dialog.getByText('Suggested')).toBeVisible()
  await expect(dialog.getByText('Previously loaded')).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Unload' })).toHaveCount(0)

  await dialog.getByRole('textbox', { name: 'Songbook URL' }).fill('/no-such-book.json')
  await dialog.getByRole('button', { name: 'Load' }).click()
  await expect(dialog.getByText(/Could not load songbook/)).toBeVisible()

  await dialog.getByRole('textbox', { name: 'Songbook URL' }).fill(BOOK_URL)
  await dialog.getByRole('button', { name: 'Load' }).click()
  await expect(dialog).toHaveCount(0)
  await expectOpenPiece(page, ARPEGGIOS)
  await expect(sidebar(page).getByText('4 of 4')).toBeVisible()
})

test('Download packs the loaded book into a .sbk with the same pieces', async ({ page }, testInfo) => {
  await openApp(page)
  await page.keyboard.press('o')
  const dialog = page.getByRole('dialog', { name: 'Songbooks' })
  const download = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Download' }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe('starter-pieces.sbk')

  const saved = testInfo.outputPath(file.suggestedFilename())
  await file.saveAs(saved)
  const manifest = readManifest(saved)
  expect(manifest.name).toBe(BOOK_NAME)
  expect(manifest.songs.map((s) => s.title)).toEqual(PIECES.map((p) => p.title))
})
