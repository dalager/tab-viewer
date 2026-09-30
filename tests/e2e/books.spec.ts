// Songbooks served by the test itself: a long one, one with broken pieces,
// and Back/Forward between books. And the rest of the songbook dialog:
// suggestions, clearing and forgetting, and loads that fail.

import { expect, type Page, test } from './fixtures'
import {
  BOOK_NAME,
  BOOK_URL,
  expectOpenPiece,
  expectScoreRendered,
  openApp,
  PIECES,
  seedStorage,
  sidebar,
  sidebarRow,
  title,
  toolbar,
  unzipSbk,
} from './helpers'

const [ARPEGGIOS] = PIECES
const GP5 = Buffer.from(unzipSbk()['tabs/arpeggios.gp5'])

const MANY = '/test-books/many/songbook.json'
const MANY_COUNT = 70
const BROKEN = '/test-books/broken/songbook.json'

const pad = (n: number) => String(n).padStart(2, '0')

/** Serves the test books: a manifest per book, and the same small tab for every piece. */
async function serveTestBooks(page: Page) {
  await page.route('**/test-books/many/songbook.json', (route) =>
    route.fulfill({
      json: {
        songbook: 1,
        name: 'Many pieces',
        songs: Array.from({ length: MANY_COUNT }, (_, i) => ({
          url: `tabs/piece-${pad(i + 1)}.gp5`,
          title: `Piece ${pad(i + 1)}`,
        })),
      },
    }),
  )
  await page.route('**/test-books/broken/songbook.json', (route) =>
    route.fulfill({
      json: {
        songbook: 1,
        name: 'Broken pieces',
        songs: [
          { url: 'tabs/fine.gp5', title: 'Fine' },
          { url: 'tabs/garbled.gp5', title: 'Garbled' },
          { url: 'tabs/missing.gp5', title: 'Missing' },
        ],
      },
    }),
  )
  await page.route('**/test-books/*/tabs/missing.gp5', (route) => route.fulfill({ status: 404 }))
  await page.route('**/test-books/*/tabs/garbled.gp5', (route) =>
    route.fulfill({ body: Buffer.from('this is not a guitar pro file') }),
  )
  await page.route(/\/test-books\/[^/]+\/tabs\/(piece-\d+|fine)\.gp5$/, (route) =>
    route.fulfill({ body: GP5 }),
  )
}

async function openSongbooks(page: Page) {
  await page.keyboard.press('o')
  return page.getByRole('dialog', { name: 'Songbooks' })
}

async function loadByUrl(page: Page, url: string) {
  const dialog = await openSongbooks(page)
  await dialog.getByRole('textbox', { name: 'Songbook URL' }).fill(url)
  // Enter submits, like the Load button.
  await dialog.getByRole('textbox', { name: 'Songbook URL' }).press('Enter')
  return dialog
}

test.beforeEach(async ({ page }) => serveTestBooks(page))

test('a long songbook lists more pieces as the list is scrolled', async ({ page }) => {
  await openApp(page)
  await loadByUrl(page, MANY)
  await expect(toolbar(page).getByRole('button', { name: 'Many pieces' })).toBeVisible()
  await expect(sidebar(page).getByText(`${MANY_COUNT} of ${MANY_COUNT}`)).toBeVisible()

  // The first 60 rows are rendered; the rest arrive once the end is in view.
  await expect(sidebar(page).getByText('Loading 10 more…')).toBeAttached()
  await expect(sidebarRow(page, 'Piece 70')).toHaveCount(0)
  await sidebarRow(page, 'Piece 60').scrollIntoViewIfNeeded()
  await expect(sidebarRow(page, 'Piece 70')).toBeAttached()
  await expect(sidebar(page).getByText(/Loading \d+ more/)).toHaveCount(0)
})

test('jumping to a piece past the rendered rows still shows it in the list', async ({ page }) => {
  await openApp(page)
  await loadByUrl(page, MANY)
  await expect(title(page)).toHaveText('Piece 01')
  await page.keyboard.press('p')
  await expect(title(page)).toHaveText('Piece 70')
  await expect(sidebarRow(page, 'Piece 70')).toBeAttached()
})

test('a piece that cannot be read, or is missing, says so', async ({ page }) => {
  await openApp(page)
  await loadByUrl(page, BROKEN)
  await expect(title(page)).toHaveText('Fine')

  await sidebarRow(page, 'Garbled').click()
  await expect(page.getByText(/Could not (load|render) this piece/)).toBeVisible()
  await sidebarRow(page, 'Missing').click()
  await expect(page.getByText(/Could not load this piece: 404/)).toBeVisible()

  // A piece that loads clears the message.
  await sidebarRow(page, 'Fine').click()
  await expectScoreRendered(page)
  await expect(page.getByText(/Could not (load|render) this piece/)).toHaveCount(0)
})

test('Back returns to a piece in the book open before, loading that book again', async ({ page }) => {
  await openApp(page)
  // Opening a piece adds a history entry; loading a book replaces the current one.
  await sidebarRow(page, PIECES[1].title).click()
  await expectOpenPiece(page, PIECES[1])
  await loadByUrl(page, MANY)
  await expect(title(page)).toHaveText('Piece 01')

  await page.goBack()
  await expectOpenPiece(page, ARPEGGIOS)
  await expect(toolbar(page).getByRole('button', { name: BOOK_NAME })).toBeVisible()
  await page.goForward()
  await expect(title(page)).toHaveText('Piece 01')
  await expect(toolbar(page).getByRole('button', { name: 'Many pieces' })).toBeVisible()
})

test('Back to another bar of the open piece jumps there without reloading it', async ({ page }) => {
  const partita = `/p/${PIECES[2].id}?book=${BOOK_URL}`
  await openApp(page, partita)
  const scrollTop = () => page.locator('.at-viewport').evaluate((v) => v.scrollTop)
  await expect.poll(scrollTop).toBeLessThan(100)

  // The app replaces its own entries, so make the history a bar link would leave.
  await page.evaluate((url) => {
    history.pushState(null, '', `${url}&bar=40`)
    history.pushState(null, '', url)
  }, partita)
  await page.goBack()
  await expect(page).toHaveURL(/&bar=40$/)
  await expect.poll(scrollTop).toBeGreaterThan(100)
  await expect(title(page)).toHaveText(PIECES[2].title)

  // Forward again: the same piece with no bar, so the score stays where it is.
  await page.goForward()
  await expect(page).toHaveURL(new RegExp(`${partita.replace(/[?./]/g, '\\$&')}$`))
  await expect(title(page)).toHaveText(PIECES[2].title)
})

test('a songbook that cannot be loaded shows why, and the open book stays', async ({ page }) => {
  await openApp(page)
  const dialog = await loadByUrl(page, '/test-books/nowhere/songbook.json')
  await expect(dialog.getByText(/Could not load songbook/)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(toolbar(page).getByRole('button', { name: BOOK_NAME })).toBeVisible()
})

test('loading the open book again changes nothing', async ({ page }) => {
  await openApp(page)
  await sidebarRow(page, PIECES[1].title).click()
  await loadByUrl(page, BOOK_URL)
  await expect(page.getByRole('dialog', { name: 'Songbooks' })).toHaveCount(0)
  await expectOpenPiece(page, PIECES[1])
})

test('a suggested book loads with one click once it has been forgotten', async ({ page }) => {
  await openApp(page)
  const dialog = await openSongbooks(page)
  await dialog.getByRole('button', { name: `Forget ${BOOK_NAME}` }).click()
  await dialog.getByRole('button', { name: BOOK_NAME }).click()
  await expectOpenPiece(page, ARPEGGIOS)
})

test('forgetting a book that is not open keeps the open one', async ({ page }) => {
  await openApp(page)
  await loadByUrl(page, MANY)
  await expect(page.getByRole('dialog', { name: 'Songbooks' })).toHaveCount(0)
  const dialog = await openSongbooks(page)
  await dialog.getByRole('button', { name: `Forget ${BOOK_NAME}` }).click()
  await expect(dialog.getByRole('button', { name: `Forget ${BOOK_NAME}` })).toHaveCount(0)
  await expect(dialog.getByText(`${MANY_COUNT} pieces`)).toBeVisible()
})

test('Clear all unloads and forgets every book, including ones opened from a file', async ({ page }) => {
  await openApp(page)
  await page.locator('input[type=file]').setInputFiles(
    new URL('../../songbooks/bach-for-guitar.sbk', import.meta.url).pathname,
  )
  // Opening the book closes any dialog, so wait for it before opening one.
  await expect(page).toHaveURL(/book=local:/)
  const dialog = await openSongbooks(page)
  await expect(dialog.getByText(/Opened from a file/).first()).toBeVisible()
  await dialog.getByRole('button', { name: 'Clear all' }).click()
  await expect(dialog.getByText('Previously loaded')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(title(page)).toHaveText('Select a piece')

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Load a songbook' })).toBeVisible()
  await expect(page.getByText('Previously loaded')).toHaveCount(0)
})

for (const [kind, stored] of [
  ['not a list', '{"not": "a list"}'],
  ['not JSON', 'not json'],
]) {
  test(`remembered books that are ${kind} are ignored`, async ({ page }) => {
    await seedStorage(page, { 'tab-viewer:visited': '1', 'tab-viewer:songbooks': stored })
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Load a songbook' })).toBeVisible()
    await expect(page.getByText('Previously loaded')).toHaveCount(0)
  })
}

test('a piece that cannot be fetched makes exporting and downloading fail with a message', async ({ page }) => {
  await openApp(page)
  await loadByUrl(page, BROKEN)
  await expect(title(page)).toHaveText('Fine')
  await expect(page.getByRole('dialog', { name: 'Songbooks' })).toHaveCount(0)

  await page.keyboard.press('e')
  const exporter = page.getByRole('dialog', { name: 'Export songbook' })
  await exporter.getByRole('button', { name: 'All', exact: true }).click()
  await exporter.getByRole('button', { name: 'Download .sbk' }).click()
  await expect(exporter.getByText(/Could not export: "Missing" could not be read/)).toBeVisible()
  await page.keyboard.press('Escape')

  const dialog = await openSongbooks(page)
  await dialog.getByRole('button', { name: 'Download' }).click()
  await expect(dialog.getByText(/Could not download: "Missing" could not be read/)).toBeVisible()
})
