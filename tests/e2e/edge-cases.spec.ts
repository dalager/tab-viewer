// The less travelled paths: full storage, a stored book gone missing, a
// songbook request overtaken by a newer one, and keys pressed with nothing
// open.

import { expect, type Page, test } from './fixtures'
import { openApp, PIECES, SBK_PATH, seedStorage, sidebar, title, toolbar, unzipSbk } from './helpers'

const GP5 = Buffer.from(unzipSbk()['tabs/arpeggios.gp5'])

async function openSongbooks(page: Page) {
  await page.keyboard.press('o')
  return page.getByRole('dialog', { name: 'Songbooks' })
}

/** Types a songbook URL into the dialog and submits it with Enter. */
async function submitUrl(page: Page, url: string) {
  const field = page.getByRole('dialog', { name: 'Songbooks' }).getByRole('textbox', { name: 'Songbook URL' })
  await field.fill(url)
  await field.press('Enter')
}

const manifest = (name: string) => ({
  songbook: 1,
  name,
  songs: [{ url: 'tabs/only.gp5', title: `${name}: only piece` }],
})

async function serveBooks(page: Page) {
  const slow = () => new Promise((resolve) => setTimeout(resolve, 1500))
  await page.route('**/test-books/slow/songbook.json', async (route) => {
    await slow()
    await route.fulfill({ json: manifest('Slow book') })
  })
  await page.route('**/test-books/slow-missing/songbook.json', async (route) => {
    await slow()
    await route.fulfill({ status: 404 })
  })
  await page.route('**/test-books/*/tabs/only.gp5', (route) => route.fulfill({ body: GP5 }))
}

test('when the browser storage is full, imports and songbook files are refused', async ({ page }) => {
  await page.addInitScript(() => {
    IDBObjectStore.prototype.put = () => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
    }
  })
  await openApp(page)
  await page.locator('input[type=file]').setInputFiles({
    name: 'mine.gp5',
    mimeType: 'application/octet-stream',
    buffer: GP5,
  })
  await expect(page.getByText(/quota has been exceeded/)).toBeVisible()
  await expect(sidebar(page).getByText('4 of 4')).toBeVisible()

  await page.locator('input[type=file]').setInputFiles(SBK_PATH)
  const books = await openSongbooks(page)
  await expect(books.getByText(/Could not store bach-for-guitar\.sbk: .*quota/)).toBeVisible()
})

test('when stored imports cannot be read, the app says so and still opens the songbook', async ({ page }) => {
  await page.addInitScript(() => {
    IDBObjectStore.prototype.getAll = () => {
      throw new DOMException('The storage is unavailable.', 'UnknownError')
    }
  })
  await openApp(page)
  await expect(page.getByText(/storage is unavailable/)).toBeVisible()
  await expect(sidebar(page).getByText('4 of 4')).toBeVisible()
})

test('an import that cannot be removed stays, and the reason shows', async ({ page }) => {
  await openApp(page)
  await page.locator('input[type=file]').setInputFiles({
    name: 'mine.gp5',
    mimeType: 'application/octet-stream',
    buffer: GP5,
  })
  await expect(sidebar(page).getByText('5 of 5')).toBeVisible()
  await page.evaluate(() => {
    IDBObjectStore.prototype.delete = () => {
      throw new DOMException('The storage is read-only.', 'ReadOnlyError')
    }
  })
  await sidebar(page).getByRole('button', { name: 'Remove imported piece' }).click()
  await expect(page.getByText(/storage is read-only/)).toBeVisible()
  await expect(sidebar(page).getByText('5 of 5')).toBeVisible()
})

test('favourites that are not JSON are ignored', async ({ page }) => {
  await seedStorage(page, { 'tab-viewer:favorites': 'not json' })
  await openApp(page)
  await expect(sidebar(page).getByRole('button', { name: 'Remove from favorites' })).toHaveCount(0)
  await expect(sidebar(page).getByRole('heading', { name: 'Starred' })).toHaveCount(0)
})

test('a songbook opened from a file that is no longer stored says so', async ({ page }) => {
  await openApp(page)
  await page.locator('input[type=file]').setInputFiles(SBK_PATH)
  await expect(page).toHaveURL(/book=local:/)

  // As if the browser had cleared its storage behind the app's back.
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('tab-viewer')
        req.onerror = () => reject(req.error)
        req.onsuccess = () => {
          const tx = req.result.transaction('songbooks', 'readwrite')
          tx.objectStore('songbooks').clear()
          tx.oncomplete = () => {
            req.result.close()
            resolve()
          }
        }
      }),
  )
  await page.reload()
  await expect(page.getByText(/no longer stored in this browser/)).toBeVisible()
})

// The dialog allows one request at a time (Load is disabled while one runs),
// but a .sbk opened meanwhile starts another.
test('a songbook request overtaken by a book file opened meanwhile is dropped', async ({ page }) => {
  await serveBooks(page)
  await openApp(page)
  await openSongbooks(page)
  await submitUrl(page, '/test-books/slow/songbook.json')
  await page.locator('input[type=file]').setInputFiles(SBK_PATH)
  await expect(page).toHaveURL(/book=local:/)

  // The slow book arrives later and is thrown away.
  await page.waitForTimeout(2000)
  await expect(page).toHaveURL(/book=local:/)
  await expect(toolbar(page).getByRole('button', { name: 'Slow book' })).toHaveCount(0)
})

test('a failing songbook request overtaken by a book file shows no error', async ({ page }) => {
  await serveBooks(page)
  await openApp(page)
  const dialog = await openSongbooks(page)
  await submitUrl(page, '/test-books/slow-missing/songbook.json')
  await page.locator('input[type=file]').setInputFiles(SBK_PATH)
  await expect(page).toHaveURL(/book=local:/)

  await page.waitForTimeout(2000)
  await page.keyboard.press('o')
  await expect(dialog.getByText(/Opened from a file/).first()).toBeVisible()
  await expect(dialog.getByText(/Could not load songbook/)).toHaveCount(0)
})

test('Enter does nothing in an empty songbook field or an export with nothing picked', async ({ page }) => {
  await openApp(page)
  const books = await openSongbooks(page)
  await books.getByRole('textbox', { name: 'Songbook URL' }).press('Enter')
  await expect(books).toBeVisible()
  await expect(books.getByText(/Could not/)).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(books).toHaveCount(0)

  await page.keyboard.press('e')
  const exporter = page.getByRole('dialog', { name: 'Export songbook' })
  await exporter.getByRole('textbox', { name: 'Songbook name' }).press('Enter')
  await expect(exporter).toBeVisible()
})

test('with nothing open, piece, track and link keys do nothing', async ({ page }) => {
  await openApp(page)
  const books = await openSongbooks(page)
  await books.getByRole('button', { name: 'Unload' }).click()
  await page.keyboard.press('Escape')
  await expect(title(page)).toHaveText('Select a piece')

  for (const key of ['n', 'p', 't', 'c']) await page.keyboard.press(key)
  await expect(title(page)).toHaveText('Select a piece')
  await expect(page).toHaveURL(/\/$/)
})

test('the Import button opens the file picker', async ({ page }) => {
  await openApp(page)
  const chooser = page.waitForEvent('filechooser')
  await toolbar(page).getByRole('button', { name: 'Import' }).click()
  expect((await chooser).isMultiple()).toBe(true)
})

test('while playing, a copied link names the bar being played', async ({ page }) => {
  await openApp(page, `/p/${PIECES[2].id}`)
  const play = toolbar(page).getByRole('button', { name: 'Play', exact: true })
  await expect(play).toBeEnabled({ timeout: 45_000 })
  await page.keyboard.press('Space')
  await expect(page.locator('.at-wrap')).toHaveAttribute('data-cursor', 'on')
  await page.waitForTimeout(1500)
  await page.keyboard.press('c')
  await expect(page).toHaveURL(/&bar=\d+$/)
  await page.keyboard.press('s')
})

test('the metronome turns off again', async ({ page }) => {
  await openApp(page)
  const metronome = toolbar(page).getByRole('button', { name: 'Metronome' })
  await expect(metronome).toBeEnabled({ timeout: 45_000 })
  await page.keyboard.press('m')
  await expect(metronome).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('m')
  await expect(metronome).toHaveAttribute('aria-pressed', 'false')
})
