// Links to pieces and bars, and the address bar as a permalink.

import { expect, test } from './fixtures'
import {
  BOOK_URL,
  expectOpenPiece,
  expectScoreRendered,
  openApp,
  PIECES,
  title,
  toolbar,
} from './helpers'

const [ARPEGGIOS, CELLO, PARTITA] = PIECES

test('a /p/<id>?book= link opens that piece in a fresh browser', async ({ page }) => {
  await openApp(page, `/p/${CELLO.id}?book=${BOOK_URL}`)
  await expectOpenPiece(page, CELLO)
})

test('a piece link without ?book= resolves against the loaded songbook', async ({ page }) => {
  await openApp(page, `/p/${PARTITA.id}`)
  await expectOpenPiece(page, PARTITA)
})

test('a link to an unknown piece falls back to the first piece', async ({ page }) => {
  await openApp(page, `/p/no-such-piece?book=${BOOK_URL}`)
  await expectOpenPiece(page, ARPEGGIOS)
})

test('a bar link scrolls the score to that bar and parks the cursor on it', async ({ page }) => {
  await openApp(page, `/p/${PARTITA.id}?book=${BOOK_URL}&bar=40`)
  await expect(title(page)).toHaveText(PARTITA.title)
  // The bar stays in the address bar, so a reload lands on it again.
  await expect(page).toHaveURL(new RegExp(`/p/${PARTITA.id}\\?book=${BOOK_URL}&bar=40$`))
  await expect.poll(() => page.locator('.at-viewport').evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
  await expect(page.locator('.at-wrap')).toHaveAttribute('data-cursor', 'on')
})

test('c copies a link to the current bar and shows it in the address bar', async ({ page }) => {
  await openApp(page)
  await page.keyboard.press('c')
  await expect(toolbar(page).getByRole('button', { name: 'Link copied' })).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/p/${ARPEGGIOS.id}\\?book=${BOOK_URL}&bar=1$`))

  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied).toBe(page.url())
  // The feedback is momentary.
  await expect(toolbar(page).getByRole('button', { name: 'Copy link' })).toBeVisible()
})

test('a copied link reopens the same bar', async ({ page }) => {
  await openApp(page, `/p/${PARTITA.id}?book=${BOOK_URL}`)
  await page.keyboard.press('End')
  // The scroll is smooth; wait for it to land before reading the top bar.
  await expect
    .poll(() =>
      page
        .locator('.at-viewport')
        .evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop),
    )
    .toBeLessThan(2)
  await page.keyboard.press('c')
  await expect(page).toHaveURL(/&bar=\d+$/)
  const bar = Number(new URL(page.url()).searchParams.get('bar'))
  expect(bar).toBeGreaterThan(1)

  await page.goto(page.url())
  await expectScoreRendered(page)
  await expect.poll(() => page.locator('.at-viewport').evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
  await expect(page).toHaveURL(new RegExp(`/p/${PARTITA.id}\\?book=${BOOK_URL}&bar=${bar}$`))
})
