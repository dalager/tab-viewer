// Exporting pieces to a new .sbk, opening one from a file, and importing tabs.

import { expect, test } from '@playwright/test'
import {
  BOOK_NAME,
  expectOpenPiece,
  expectScoreRendered,
  openApp,
  PIECES,
  readManifest,
  sidebar,
  sidebarRow,
  title,
  toolbar,
  unzipSbk,
} from './helpers'

const [ARPEGGIOS, CELLO] = PIECES

test('e exports the selected pieces as a downloadable .sbk', async ({ page }, testInfo) => {
  await openApp(page)
  await page.keyboard.press('e')
  const dialog = page.getByRole('dialog', { name: 'Export songbook' })
  await expect(dialog.getByRole('textbox', { name: 'Songbook name' })).toHaveValue(
    `${BOOK_NAME} (selection)`,
  )
  await expect(dialog.getByText('0 of 3 selected')).toBeVisible()
  const submit = dialog.getByRole('button', { name: 'Download .sbk' })
  await expect(submit).toBeDisabled()

  await dialog.getByRole('button', { name: 'All', exact: true }).click()
  await expect(dialog.getByText('3 of 3 selected')).toBeVisible()
  await dialog.getByRole('button', { name: 'None', exact: true }).click()
  await expect(dialog.getByText('0 of 3 selected')).toBeVisible()
  await dialog.getByRole('checkbox').nth(1).click()
  await dialog.getByRole('checkbox').nth(2).click()
  await expect(dialog.getByText('2 of 3 selected')).toBeVisible()

  await dialog.getByRole('textbox', { name: 'Songbook name' }).fill('Two Preludes')
  await dialog.getByRole('textbox', { name: 'Description' }).fill('Picked in a test')
  const download = page.waitForEvent('download')
  await submit.click()
  const file = await download
  expect(file.suggestedFilename()).toBe('two-preludes.sbk')
  await expect(dialog).toHaveCount(0)

  const saved = testInfo.outputPath(file.suggestedFilename())
  await file.saveAs(saved)
  const manifest = readManifest(saved)
  expect(manifest).toMatchObject({ name: 'Two Preludes', description: 'Picked in a test' })
  expect(manifest.songs.map((s) => s.title)).toEqual([PIECES[1].title, PIECES[2].title])
  const entries = unzipSbk(saved)
  for (const song of manifest.songs) expect(entries[song.url]?.length).toBeGreaterThan(0)
})

test('Save & open keeps the export in this browser and switches to it', async ({ page }) => {
  await openApp(page)
  await sidebar(page).getByRole('button', { name: 'Export…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Export songbook' })
  await dialog.getByRole('textbox', { name: 'Filter pieces to export' }).fill('cello')
  await dialog.getByRole('button', { name: 'All', exact: true }).click()
  await expect(dialog.getByText('1 of 3 selected')).toBeVisible()
  await dialog.getByRole('textbox', { name: 'Songbook name' }).fill('Cello only')
  await dialog.getByRole('button', { name: 'Save & open' }).click()
  await expect(dialog).toHaveCount(0)

  await expect(toolbar(page).getByRole('button', { name: 'Cello only' })).toBeVisible()
  await expect(sidebar(page).getByText('1 of 1')).toBeVisible()
  await expect(title(page)).toHaveText(CELLO.title)
  await expectScoreRendered(page)
  // Pieces in a book opened from a file only exist in this browser.
  await expect(page).toHaveURL(/\/p\/cello-prelude-1-in-b-major\?book=local:/)
  await expect(toolbar(page).getByRole('button', { name: 'Copy link' })).toBeDisabled()

  await page.keyboard.press('o')
  const books = page.getByRole('dialog', { name: 'Songbooks' })
  await expect(books.getByText('1 pieces · Opened from a file, stored in this browser')).toBeVisible()

  // It survives a reload, and the bundled book is still one click away.
  await page.reload()
  await expect(toolbar(page).getByRole('button', { name: 'Cello only' })).toBeVisible()
  await page.keyboard.press('o')
  await books.getByRole('button', { name: new RegExp(`^${BOOK_NAME}`) }).click()
  // The bundled book has the open piece too, so it stays open rather than jumping.
  await expectOpenPiece(page, CELLO)
  await expect(sidebar(page).getByText('3 of 3')).toBeVisible()
})

test('importing a Guitar Pro file lists it under Imported until it is removed', async ({ page }) => {
  await openApp(page)
  const entries = unzipSbk()
  const gp5 = entries['tabs/arpeggios.gp5']
  await page.locator('input[type=file]').setInputFiles({
    name: 'my-own-arpeggios.gp5',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from(gp5),
  })

  await expect(sidebar(page).getByRole('heading', { name: 'Imported' })).toBeVisible()
  await expect(sidebar(page).getByRole('heading', { name: BOOK_NAME })).toBeVisible()
  await expect(sidebar(page).getByText('4 of 4')).toBeVisible()
  const remove = sidebar(page).getByRole('button', { name: 'Remove imported piece' })
  await expect(remove).toHaveCount(1)
  // The import opens straight away; its file only lives here, so no link.
  await expect(page).toHaveURL(/\/p\/imported-/)
  await expect(toolbar(page).getByRole('button', { name: 'Copy link' })).toBeDisabled()
  await expectScoreRendered(page)

  await page.reload()
  await expect(sidebar(page).getByText('4 of 4')).toBeVisible()
  await expect(page).toHaveURL(/\/p\/imported-/)

  await remove.click()
  await expect(sidebar(page).getByText('3 of 3')).toBeVisible()
  await expect(sidebar(page).getByRole('heading', { name: 'Imported' })).toHaveCount(0)
  await expectOpenPiece(page, ARPEGGIOS)
})

test('a file that is not a tab is refused with a message', async ({ page }) => {
  await openApp(page)
  await page.locator('input[type=file]').setInputFiles({
    name: 'notes.gp5',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('this is not a guitar pro file'),
  })
  await expect(page.getByText(/notes\.gp5: could not be read/)).toBeVisible()
  await expect(sidebar(page).getByText('3 of 3')).toBeVisible()
})

test('opening a .sbk file loads it as a songbook stored in this browser', async ({ page }) => {
  await openApp(page)
  await sidebarRow(page, ARPEGGIOS.title).waitFor()
  await page.locator('input[type=file]').setInputFiles(
    new URL('../../songbooks/bach-for-guitar.sbk', import.meta.url).pathname,
  )
  await page.keyboard.press('o')
  const books = page.getByRole('dialog', { name: 'Songbooks' })
  await expect(books.getByText('3 pieces · Opened from a file, stored in this browser')).toBeVisible()
  await expect(books.getByRole('button', { name: new RegExp(`^${BOOK_NAME}`) })).toHaveCount(2)
})
