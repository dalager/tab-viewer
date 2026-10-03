// Collections: an address that lists songbooks. Adding one by hand and by
// link, opening the books it lists, seeing what its host changed, and what
// happens when it cannot be read. The test serves the collections itself.

import { expect, type Page, test } from './fixtures'
import { expectScoreRendered, openApp, seedStorage, title, toolbar, unzipSbk } from './helpers'

const GP5 = Buffer.from(unzipSbk()['tabs/arpeggios.gp5'])
const STORED = 'tab-viewer:collections'
const EASY = '/test-collections/easy/'

const week = (n: number) => ({ url: `week-${n}/songbook.json`, name: `Week ${n}`, songs: 1 })

/**
 * Serves a collection of weekly songbooks under /test-collections/easy/. The
 * returned list is what the host holds: push to it to publish another book.
 */
async function serveEasy(page: Page) {
  const books = [week(1)]
  await page.route('**/test-collections/easy/collection.json', (route) =>
    route.fulfill({
      json: { collection: 1, name: 'Easy pieces', description: 'One a week', books },
    }),
  )
  await page.route(/\/test-collections\/easy\/week-(\d+)\/songbook\.json$/, (route) => {
    const n = /week-(\d+)/.exec(route.request().url())?.[1]
    return route.fulfill({
      json: { songbook: 1, name: `Week ${n}`, songs: [{ url: 'tabs/study.gp5', title: `Study ${n}` }] },
    })
  })
  await page.route('**/test-collections/easy/*/tabs/study.gp5', (route) =>
    route.fulfill({ body: GP5 }),
  )
  return books
}

async function openSongbooks(page: Page) {
  await page.keyboard.press('o')
  return page.getByRole('dialog', { name: 'Songbooks' })
}

const urlField = (scope: Page | ReturnType<Page['getByRole']>) =>
  scope.getByRole('textbox', { name: 'Collection URL' })

const stored = (page: Page) => page.evaluate((key) => localStorage.getItem(key), STORED)

test('a browser that has added none lists none, and offers to add one', async ({ page }) => {
  await openApp(page)
  const dialog = await openSongbooks(page)
  await expect(urlField(dialog)).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Add', exact: true })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: /^Remove / })).toHaveCount(0)
})

test('adding a collection lists its books, and one of them opens', async ({ page, baseURL }) => {
  await serveEasy(page)
  await openApp(page)
  const dialog = await openSongbooks(page)

  // A folder, written without its trailing slash and submitted with Enter.
  await urlField(dialog).fill('/test-collections/easy')
  await urlField(dialog).press('Enter')

  const easy = dialog.getByRole('listitem', { name: 'Easy pieces' })
  await expect(easy.getByRole('button', { name: /Week 1/ })).toContainText('1 piece')
  await expect(urlField(dialog)).toHaveValue('')
  expect(await stored(page)).toBe(JSON.stringify([{ url: `${baseURL}${EASY}`, name: 'Easy pieces' }]))

  await easy.getByRole('button', { name: /Week 1/ }).click()
  await expect(dialog).toBeHidden()
  await expect(toolbar(page).getByRole('button', { name: 'Week 1' })).toBeVisible()
  await expect(title(page)).toHaveText('Study 1')
  await expect(page).toHaveURL(/\/p\/study\?book=\/test-collections\/easy\/week-1\/songbook\.json$/)
  await expectScoreRendered(page)
})

test('a collection is kept across a reload, and shows what its host has added since', async ({ page }) => {
  const books = await serveEasy(page)
  await openApp(page)
  let dialog = await openSongbooks(page)
  await urlField(dialog).fill(EASY)
  await dialog.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(dialog.getByRole('button', { name: /Week 1/ })).toBeVisible()
  await expect(dialog.getByRole('button', { name: /Week 2/ })).toHaveCount(0)

  books.push(week(2))
  await page.reload()
  await expectScoreRendered(page)
  dialog = await openSongbooks(page)
  const easy = dialog.getByRole('listitem', { name: 'Easy pieces' })
  await expect(easy.getByRole('button', { name: /Week 2/ })).toBeVisible()

  // Adding it again does not list it twice.
  await urlField(dialog).fill('/test-collections/easy')
  await urlField(dialog).press('Enter')
  await expect(urlField(dialog)).toHaveValue('')
  await expect(dialog.getByRole('listitem', { name: 'Easy pieces' })).toHaveCount(1)
})

test('a link adds a collection, shows it, and leaves the address clean', async ({ page }) => {
  await serveEasy(page)
  await page.goto('/?addcollection=/test-collections/easy')

  const dialog = page.getByRole('dialog', { name: 'Songbooks' })
  const easy = dialog.getByRole('listitem', { name: 'Easy pieces' })
  await expect(easy.getByRole('button', { name: /Week 1/ })).toBeVisible()
  expect(page.url()).not.toContain('addcollection')

  // A reload neither asks again nor forgets it.
  await page.reload()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expectScoreRendered(page)
  await expect((await openSongbooks(page)).getByRole('listitem', { name: 'Easy pieces' })).toBeVisible()
})

test('a link to something that is not a collection says so and saves nothing', async ({ page }) => {
  await page.goto('/?addcollection=/songbooks/bach-for-guitar.sbk')
  const dialog = page.getByRole('dialog', { name: 'Songbooks' })
  await expect(dialog.getByText(/Could not add collection: .*collection\.json returned a web page/)).toBeVisible()
  expect(await stored(page)).toBe('[]')
})

test('an address that is not a collection is refused, and a songbook is pointed the right way', async ({ page }) => {
  await page.route('**/test-collections/page/collection.json', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Sign in</title>' }),
  )
  await page.route('**/test-collections/book.json', (route) =>
    route.fulfill({ json: { songbook: 1, name: 'A book', songs: [] } }),
  )
  await openApp(page)
  const dialog = await openSongbooks(page)

  await urlField(dialog).fill('/test-collections/page/')
  await urlField(dialog).press('Enter')
  await expect(dialog.getByText(/returned a web page, not a collection/)).toBeVisible()
  // What was typed stays, to be corrected.
  await expect(urlField(dialog)).toHaveValue('/test-collections/page/')

  await urlField(dialog).fill('/test-collections/book.json')
  await urlField(dialog).press('Enter')
  await expect(dialog.getByText(/this is a songbook, not a collection/)).toBeVisible()
  await expect(dialog.getByRole('button', { name: /^Remove / })).toHaveCount(0)
  expect(await stored(page)).toBe('[]')
})

test('a saved collection that cannot be reached says so, recovers on Retry, and can be removed', async ({ page, baseURL }) => {
  let up = false
  await page.route('**/test-collections/flaky/collection.json', (route) =>
    up
      ? route.fulfill({ json: { collection: 1, name: 'Back again', books: [] } })
      : route.fulfill({ status: 503 }),
  )
  await serveEasy(page)
  await seedStorage(page, {
    [STORED]: JSON.stringify([
      { url: `${baseURL}/test-collections/flaky/`, name: 'Flaky' },
      { url: `${baseURL}${EASY}`, name: 'Easy pieces' },
    ]),
  })
  await openApp(page)
  const dialog = await openSongbooks(page)

  // It goes by the name it had when added; the other collection is unaffected.
  const flaky = dialog.getByRole('listitem', { name: 'Flaky' })
  await expect(flaky.getByText(/collection\.json: 503/)).toBeVisible()
  await expect(dialog.getByRole('button', { name: /Week 1/ })).toBeVisible()

  up = true
  await flaky.getByRole('button', { name: 'Retry' }).click()
  const back = dialog.getByRole('listitem', { name: 'Back again' })
  await expect(back.getByText('No books in this collection yet.')).toBeVisible()

  await back.getByRole('button', { name: 'Remove Back again' }).click()
  await expect(dialog.getByRole('listitem', { name: 'Back again' })).toHaveCount(0)
  await expect(dialog.getByRole('listitem', { name: 'Easy pieces' })).toBeVisible()
  expect(await stored(page)).toBe(JSON.stringify([{ url: `${baseURL}${EASY}`, name: 'Easy pieces' }]))
})

test('a second device with an empty library gets the same books from the same collection', async ({ page }) => {
  await serveEasy(page)
  await seedStorage(page, { 'tab-viewer:visited': '1' })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Load a songbook' })).toBeVisible()

  await urlField(page).fill(EASY)
  await urlField(page).press('Enter')
  await page.getByRole('button', { name: /Week 1/ }).click()

  await expect(title(page)).toHaveText('Study 1')
  // The book's address, and so its links and favourites, is the one every device gets.
  await expect(page).toHaveURL(/\?book=\/test-collections\/easy\/week-1\/songbook\.json$/)

  // The open book is the highlighted one where the collection lists it.
  const dialog = await openSongbooks(page)
  await expect(dialog.getByRole('button', { name: /Week 1.*1 piece/ })).toHaveClass(/bg-neutral-900/)
})
