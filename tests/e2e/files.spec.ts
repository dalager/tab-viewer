// Getting files in by dropping them on the app, what is refused, and the
// export dialog's shortcuts: the starred pieces, the filter, and Enter.

import fs from 'node:fs'
import { expect, type Page, test } from './fixtures'
import {
  BOOK_NAME,
  expectScoreRendered,
  openApp,
  PIECES,
  SBK_PATH,
  sidebar,
  sidebarRow,
  storedBookCount,
  title,
  unzipSbk,
} from './helpers'

const [, CELLO] = PIECES
const ARPEGGIOS_GP5 = [...unzipSbk()['tabs/arpeggios.gp5']]
const SBK = [...fs.readFileSync(SBK_PATH)]

interface DroppedFile {
  name: string
  bytes: number[]
}

/** A drag carrying these files, or only text when there are none. */
function dragOf(page: Page, files: DroppedFile[]) {
  return page.evaluateHandle((files) => {
    const drag = new DataTransfer()
    for (const f of files) drag.items.add(new File([new Uint8Array(f.bytes)], f.name))
    if (files.length === 0) drag.setData('text/plain', 'just some text')
    return drag
  }, files)
}

/** Drags the files in over the app, across one child element, and drops them. */
async function dropFiles(page: Page, files: DroppedFile[]) {
  const shell = page.locator('#root > div')
  const dataTransfer = await dragOf(page, files)
  await shell.dispatchEvent('dragenter', { dataTransfer })
  await shell.dispatchEvent('dragenter', { dataTransfer })
  await shell.dispatchEvent('dragover', { dataTransfer })
  await shell.dispatchEvent('dragleave', { dataTransfer })
  await shell.dispatchEvent('drop', { dataTransfer })
}

test('dragging files over the app shows where to drop them, and leaving hides it', async ({ page }) => {
  await openApp(page)
  const shell = page.locator('#root > div')
  const dataTransfer = await dragOf(page, [{ name: 'tab.gp5', bytes: ARPEGGIOS_GP5 }])
  await shell.dispatchEvent('dragenter', { dataTransfer })
  await expect(page.getByText('Drop to import')).toBeVisible()
  await shell.dispatchEvent('dragleave', { dataTransfer })
  await expect(page.getByText('Drop to import')).toHaveCount(0)
})

test('dragging text over the app is ignored', async ({ page }) => {
  await openApp(page)
  await dropFiles(page, [])
  await expect(page.getByText('Drop to import')).toHaveCount(0)
  await expect(sidebar(page).getByText('4 of 4')).toBeVisible()
})

test('a dropped Guitar Pro file is imported and opened', async ({ page }) => {
  await openApp(page)
  await dropFiles(page, [{ name: 'dropped.gp5', bytes: ARPEGGIOS_GP5 }])
  await expect(page.getByText('Drop to import')).toHaveCount(0)
  await expect(sidebar(page).getByRole('heading', { name: 'Imported' })).toBeVisible()
  await expect(page).toHaveURL(/\/p\/imported-/)
  // The file has no title of its own, so it is named after the file.
  await expect(title(page)).toHaveText('dropped')
  await expectScoreRendered(page)
})

test('a dropped .sbk opens as the songbook, even with tabs dropped alongside', async ({ page }) => {
  await openApp(page)
  await dropFiles(page, [
    { name: 'extra.gp5', bytes: ARPEGGIOS_GP5 },
    { name: 'book.sbk', bytes: SBK },
  ])
  // Opening the book closes any dialog, so wait for it before opening one.
  await expect(page).toHaveURL(/book=local:/)
  await page.keyboard.press('o')
  const books = page.getByRole('dialog', { name: 'Songbooks' })
  await expect(books.getByText(/Opened from a file, stored in this browser/).first()).toBeVisible()
  await page.keyboard.press('Escape')
  // The tab is imported too, but the book is what opens.
  await expect(sidebar(page).getByRole('heading', { name: 'Imported' })).toBeVisible()
  await expect(page).not.toHaveURL(/\/p\/imported-/)
})

test('files that are not tabs are refused, each with a reason', async ({ page }) => {
  await openApp(page)
  await page.locator('input[type=file]').setInputFiles([
    { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') },
    { name: 'noext', mimeType: 'application/octet-stream', buffer: Buffer.from('hello') },
  ])
  await expect(page.getByText(/notes\.txt: not a Guitar Pro file/)).toBeVisible()
  await expect(page.getByText(/noext: not a Guitar Pro file/)).toBeVisible()
  await expect(sidebar(page).getByText('4 of 4')).toBeVisible()
})

test('a .sbk that is not a songbook is refused with a message', async ({ page }) => {
  await openApp(page)
  await page.locator('input[type=file]').setInputFiles({
    name: 'broken.sbk',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('not a zip at all'),
  })
  await page.keyboard.press('o')
  const books = page.getByRole('dialog', { name: 'Songbooks' })
  await expect(books.getByText('Could not load songbook: not a readable zip', { exact: false })).toBeVisible()
  // Nothing can open it, so it is not kept.
  await expect.poll(() => storedBookCount(page)).toBe(0)
  await expect(books.getByText(BOOK_NAME).first()).toBeVisible()
})

test('the export dialog picks the starred pieces, filters, and exports on Enter', async ({ page }) => {
  await openApp(page)
  await sidebar(page).getByRole('button', { name: 'Add to favorites' }).nth(1).click()
  await page.locator('input[type=file]').setInputFiles({
    name: 'my-own.gp5',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from(ARPEGGIOS_GP5),
  })
  await expect(sidebar(page).getByRole('heading', { name: 'Imported' })).toBeVisible()

  await page.keyboard.press('e')
  const dialog = page.getByRole('dialog', { name: 'Export songbook' })
  // Starred pieces start ticked; imports are labelled as such.
  await expect(dialog.getByText('1 of 5 selected')).toBeVisible()
  await expect(dialog.getByText('Imported', { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'None', exact: true }).click()
  await dialog.getByRole('button', { name: 'Starred' }).click()
  await expect(dialog.getByText('1 of 5 selected')).toBeVisible()

  const filter = dialog.getByRole('textbox', { name: 'Filter pieces to export' })
  await filter.fill('no such piece')
  await expect(dialog.getByText('No matches')).toBeVisible()
  await filter.fill('')

  const download = page.waitForEvent('download')
  await dialog.getByRole('textbox', { name: 'Songbook name' }).press('Enter')
  expect((await download).suggestedFilename()).toBe('starter-pieces-selection.sbk')
  await expect(dialog).toHaveCount(0)
  await expect(sidebarRow(page, CELLO.title)).toHaveCount(2)
})

test('with no songbook loaded, an export of imports is called My songbook', async ({ page }) => {
  await openApp(page)
  await page.keyboard.press('o')
  await page.getByRole('dialog', { name: 'Songbooks' }).getByRole('button', { name: 'Unload' }).click()
  await page.keyboard.press('Escape')
  await page.locator('input[type=file]').setInputFiles({
    name: 'mine.gp5',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from(ARPEGGIOS_GP5),
  })
  await expect(title(page)).toHaveText('mine')
  await page.keyboard.press('e')
  const dialog = page.getByRole('dialog', { name: 'Export songbook' })
  await expect(dialog.getByRole('textbox', { name: 'Songbook name' })).toHaveValue('My songbook')
})
