// First visit, moving between pieces, and what the app remembers.

import { expect, test } from './fixtures'
import {
  BOOK_NAME,
  BOOK_URL,
  expectOpenPiece,
  expectScoreRendered,
  openApp,
  PIECES,
  sidebar,
  sidebarRow,
  title,
  toolbar,
} from './helpers'

const [ARPEGGIOS, CELLO, PARTITA, LICK] = PIECES

test('a first visit opens the bundled songbook on its first piece', async ({ page }) => {
  await openApp(page)
  await expect(sidebar(page).getByText(`4 of 4`)).toBeVisible()
  for (const piece of PIECES) await expect(sidebarRow(page, piece.title)).toBeVisible()
  await expectOpenPiece(page, ARPEGGIOS)
  await expect(page.getByText('Bach · GP5')).toBeVisible()
  // Nothing else is starred or imported, so the list has no section headings.
  await expect(sidebar(page).getByRole('heading', { name: 'Starred' })).toHaveCount(0)
  await expect(sidebar(page).getByRole('heading', { name: BOOK_NAME })).toHaveCount(0)
})

test('clicking a piece opens it, and Back returns to the one before', async ({ page }) => {
  await openApp(page)
  await sidebarRow(page, CELLO.title).click()
  await expectOpenPiece(page, CELLO)
  await expectScoreRendered(page)

  await page.goBack()
  await expectOpenPiece(page, ARPEGGIOS)
  await page.goForward()
  await expectOpenPiece(page, CELLO)
})

test('n and p step through the pieces and wrap around', async ({ page }) => {
  await openApp(page)
  await page.keyboard.press('n')
  await expectOpenPiece(page, CELLO)
  await page.keyboard.press('n')
  await expectOpenPiece(page, PARTITA)
  await page.keyboard.press('n')
  await expectOpenPiece(page, LICK)
  await page.keyboard.press('n')
  await expectOpenPiece(page, ARPEGGIOS)
  await page.keyboard.press('p')
  await expectOpenPiece(page, LICK)
  await page.keyboard.press(']')
  await expectOpenPiece(page, ARPEGGIOS)
  await page.keyboard.press('[')
  await expectOpenPiece(page, LICK)
})

test('the last open piece is reopened on the next visit', async ({ page }) => {
  await openApp(page)
  await sidebarRow(page, PARTITA.title).click()
  await expectOpenPiece(page, PARTITA)
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('tab-viewer:selected')))
    .toBe(`${new URL(BOOK_URL, page.url()).href}#${PARTITA.id}`)

  await page.goto('/')
  await expectOpenPiece(page, PARTITA)
  await expectScoreRendered(page)
})

test('the sidebar filter narrows the list and reports the count', async ({ page }) => {
  await openApp(page)
  const filter = sidebar(page).getByRole('textbox', { name: 'Filter pieces' })
  await filter.fill('cello')
  await expect(sidebar(page).getByText('1 of 4')).toBeVisible()
  await expect(sidebarRow(page, CELLO.title)).toBeVisible()
  await expect(sidebarRow(page, ARPEGGIOS.title)).toHaveCount(0)

  await filter.fill('no such piece')
  await expect(sidebar(page).getByText('0 of 4')).toBeVisible()
  await expect(sidebar(page).getByText('No matches')).toBeVisible()

  await filter.fill('')
  await expect(sidebar(page).getByText('4 of 4')).toBeVisible()
})

test('starring a piece repeats it in a Starred section that survives a reload', async ({ page }) => {
  await openApp(page)
  const star = sidebar(page).getByRole('button', { name: 'Add to favorites' }).nth(1)
  await star.click()

  await expect(sidebar(page).getByRole('heading', { name: 'Starred' })).toBeVisible()
  await expect(sidebar(page).getByRole('heading', { name: BOOK_NAME })).toBeVisible()
  await expect(sidebarRow(page, CELLO.title)).toHaveCount(2)
  await expect(sidebar(page).getByRole('button', { name: 'Remove from favorites' })).toHaveCount(2)

  await page.reload()
  await expect(sidebar(page).getByRole('heading', { name: 'Starred' })).toBeVisible()
  await expect(sidebarRow(page, CELLO.title)).toHaveCount(2)

  await sidebar(page).getByRole('button', { name: 'Remove from favorites' }).first().click()
  await expect(sidebar(page).getByRole('heading', { name: 'Starred' })).toHaveCount(0)
  await expect(sidebarRow(page, CELLO.title)).toHaveCount(1)
})

test('b hides and shows the sidebar', async ({ page }) => {
  await openApp(page)
  await page.keyboard.press('b')
  await expect(sidebar(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Show list' })).toBeVisible()
  await expect(title(page)).toHaveText(ARPEGGIOS.title)
  await page.getByRole('button', { name: 'Show list' }).click()
  await expect(sidebar(page)).toBeVisible()
})

test('a star belongs to its book, not to every piece with the same id', async ({ page }) => {
  await openApp(page)
  await sidebar(page).getByRole('button', { name: 'Add to favorites' }).nth(1).click()
  await expect(sidebar(page).getByRole('heading', { name: 'Starred' })).toBeVisible()

  // A copy of the book: the export preselects the starred piece, and its ids
  // come from the titles, so the copy's piece has the same id as the original.
  await page.keyboard.press('e')
  const dialog = page.getByRole('dialog', { name: 'Export songbook' })
  await expect(dialog.getByText('1 of 4 selected')).toBeVisible()
  await dialog.getByRole('textbox', { name: 'Songbook name' }).fill('Bach copy')
  await dialog.getByRole('button', { name: 'Save & open' }).click()
  await expect(toolbar(page).getByRole('button', { name: 'Bach copy', exact: true })).toBeVisible()
  await expect(title(page)).toHaveText(CELLO.title)
  await expect(sidebarRow(page, CELLO.title)).toHaveCount(1)
  await expect(sidebar(page).getByRole('heading', { name: 'Starred' })).toHaveCount(0)

  await page.keyboard.press('o')
  const books = page.getByRole('dialog', { name: 'Songbooks' })
  await books.getByRole('button', { name: new RegExp(`^${BOOK_NAME}`) }).click()
  await expect(sidebar(page).getByRole('heading', { name: 'Starred' })).toBeVisible()
  await expect(sidebarRow(page, CELLO.title)).toHaveCount(2)
})

test('favorites stored by an older version are attached to the loaded book', async ({ page }) => {
  await openApp(page)
  await page.evaluate((id) => {
    localStorage.setItem('tab-viewer:favorites', JSON.stringify([id]))
  }, CELLO.id)

  await page.reload()
  await expect(sidebar(page).getByRole('heading', { name: 'Starred' })).toBeVisible()
  await expect(sidebarRow(page, CELLO.title)).toHaveCount(2)
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('tab-viewer:favorites')))
    .toBe(JSON.stringify([`${new URL(BOOK_URL, page.url()).href}#${CELLO.id}`]))
})
