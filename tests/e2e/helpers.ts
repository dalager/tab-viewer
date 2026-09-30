// Shared fixtures for the end-to-end suite: the bundled songbook's pieces,
// helpers that wait for alphaTab to paint, and a way to get at the files
// inside a .sbk without going through the browser.

import fs from 'node:fs'
import path from 'node:path'
import { unzipSync } from 'fflate'
import { expect, type Locator, type Page } from '@playwright/test'

export const BOOK_URL = '/songbooks/bach-for-guitar.sbk'
export const BOOK_NAME = 'Starter pieces'

/** The bundled book's pieces, in sidebar order (see songbooks/bach-for-guitar.sbk). */
export const PIECES = [
  { id: 'arpeggios', title: 'Arpeggios' },
  { id: 'cello-prelude-1-in-b-major', title: 'Cello Prelude 1 In B Major' },
  { id: 'partita-no-3-in-e-major-s-1006-preludio', title: 'Partita No 3 In E Major S 1006 Preludio' },
  { id: 'my-jazz-lick', title: 'My Jazz Lick' },
] as const

export const SBK_PATH = path.resolve(import.meta.dirname, '../../songbooks/bach-for-guitar.sbk')

/** Every entry of a .sbk on disk, by path inside the zip. */
export function unzipSbk(file: string = SBK_PATH): Record<string, Uint8Array> {
  return unzipSync(new Uint8Array(fs.readFileSync(file)))
}

/** The manifest inside a .sbk, parsed. */
export function readManifest(file: string): { name: string; description?: string; songs: { id: string; title: string; url: string }[] } {
  const entries = unzipSbk(file)
  const name = Object.keys(entries).find((n) => /(^|\/)songbook\.json$/.test(n))
  if (!name) throw new Error(`no songbook.json in ${file}`)
  return JSON.parse(new TextDecoder().decode(entries[name]))
}

/** The `/p/<id>?book=<url>` address the app writes for a bundled piece. */
export function pieceUrl(id: string): RegExp {
  return new RegExp(`/p/${id}\\?book=${BOOK_URL.replace(/[/.]/g, '\\$&')}$`)
}

export const toolbar = (page: Page) => page.getByRole('banner')
export const sidebar = (page: Page) => page.getByRole('complementary')
export const title = (page: Page) => toolbar(page).getByRole('heading', { level: 1 })
export const sidebarRow = (page: Page, name: string): Locator =>
  sidebar(page).getByRole('button', { name, exact: true })

/** Waits until alphaTab has painted the open piece's score. */
export async function expectScoreRendered(page: Page) {
  await expect(page.locator('.at-canvas svg').first()).toBeVisible({ timeout: 45_000 })
}

/** Opens the app at `path` and waits for the bundled book and first score. */
export async function openApp(page: Page, path = '/') {
  await page.goto(path)
  await expect(toolbar(page).getByRole('button', { name: BOOK_NAME })).toBeVisible()
  await expectScoreRendered(page)
}

/** Waits for the given piece to be the open one, in the toolbar and the address bar. */
export async function expectOpenPiece(page: Page, piece: (typeof PIECES)[number]) {
  await expect(title(page)).toHaveText(piece.title)
  await expect(page).toHaveURL(pieceUrl(piece.id))
}
