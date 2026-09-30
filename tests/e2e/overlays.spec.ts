// The search palette, the help overlay and the view controls in the toolbar.

import { expect, test } from './fixtures'
import { expectOpenPiece, openApp, PIECES, pieceUrl, toolbar } from './helpers'

const [ARPEGGIOS, CELLO, PARTITA] = PIECES

test('? opens the shortcut help and closes it again', async ({ page }) => {
  await openApp(page)
  await page.keyboard.press('?')
  const help = page.getByRole('dialog', { name: 'Keyboard shortcuts' })
  await expect(help).toBeVisible()
  await expect(help.getByText('Toggle full screen')).toBeVisible()
  await expect(help.getByText('Export pieces as a songbook')).toBeVisible()
  await expect(help.getByRole('link', { name: 'Source on GitHub' })).toHaveAttribute(
    'href',
    'https://github.com/dalager/tab-viewer',
  )

  await page.keyboard.press('?')
  await expect(help).toHaveCount(0)

  await toolbar(page).getByRole('button', { name: 'Keyboard shortcuts' }).click()
  await expect(help).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(help).toHaveCount(0)
})

test('shortcuts are ignored while an overlay is open', async ({ page }) => {
  await openApp(page)
  await page.keyboard.press('?')
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible()
  await page.keyboard.press('n')
  // The dialog hides the toolbar from the accessibility tree, so check the address.
  await expect(page).toHaveURL(pieceUrl(ARPEGGIOS.id))
  await page.keyboard.press('Escape')
  await page.keyboard.press('n')
  await expectOpenPiece(page, CELLO)
})

test('? is typed into text fields rather than opening the help', async ({ page }) => {
  await openApp(page)
  const filter = page.getByRole('textbox', { name: 'Filter pieces' })
  await filter.click()
  await page.keyboard.type('cello?')
  await expect(filter).toHaveValue('cello?')
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toHaveCount(0)

  await filter.fill('')
  await filter.blur()
  await page.keyboard.press('/')
  const palette = page.getByRole('dialog', { name: 'Find a piece' })
  const search = palette.getByPlaceholder('Search pieces…')
  await page.keyboard.type('what?')
  await expect(search).toHaveValue('what?')
  await expect(palette).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toHaveCount(0)
})

test('/ opens the search palette and Enter opens the match', async ({ page }) => {
  await openApp(page)
  await page.keyboard.press('/')
  const palette = page.getByRole('dialog', { name: 'Find a piece' })
  await expect(palette).toBeVisible()
  await expect(palette.getByText('4 pieces')).toBeVisible()

  await palette.getByPlaceholder('Search pieces…').fill('partita')
  await expect(palette.getByRole('option')).toHaveCount(1)
  await page.keyboard.press('Enter')
  await expect(palette).toHaveCount(0)
  await expectOpenPiece(page, PARTITA)
})

test('Ctrl+K and the Search button open the palette too', async ({ page }) => {
  await openApp(page)
  const palette = page.getByRole('dialog', { name: 'Find a piece' })
  await page.keyboard.press('Control+k')
  await expect(palette).toBeVisible()
  await palette.getByPlaceholder('Search pieces…').fill('xyzzy')
  await expect(palette.getByText('No pieces found.')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(palette).toHaveCount(0)

  await toolbar(page).getByRole('button', { name: 'Search' }).click()
  await expect(palette).toBeVisible()
  await palette.getByRole('option', { name: CELLO.title }).click()
  await expectOpenPiece(page, CELLO)
})

test('zoom keys change the scale shown in the toolbar', async ({ page }) => {
  await openApp(page)
  const zoom = toolbar(page).getByRole('button', { name: /^\d+%$/ })
  await expect(zoom).toHaveText('100%')
  await page.keyboard.press('+')
  await expect(zoom).toHaveText('110%')
  await page.keyboard.press('-')
  await page.keyboard.press('-')
  await expect(zoom).toHaveText('90%')
  await page.keyboard.press('0')
  await expect(zoom).toHaveText('100%')
  await toolbar(page).getByRole('button', { name: 'Zoom in' }).click()
  await expect(zoom).toHaveText('110%')
})

test('l cycles the layout between page and horizontal', async ({ page }) => {
  await openApp(page)
  await expect(toolbar(page).getByRole('button', { name: 'Layout: Page' })).toBeVisible()
  await page.keyboard.press('l')
  await expect(toolbar(page).getByRole('button', { name: 'Layout: Horizontal' })).toBeVisible()
  await page.keyboard.press('l')
  await expect(toolbar(page).getByRole('button', { name: 'Layout: Page' })).toBeVisible()
})
