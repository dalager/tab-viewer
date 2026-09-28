// Playback controls. The synthesizer runs in an AudioWorklet, which headless
// Chromium provides without a sound device.

import { expect, test } from '@playwright/test'
import { openApp, toolbar } from './helpers'

test('Space plays and pauses, s stops, m toggles the metronome', async ({ page }) => {
  await openApp(page)
  const play = toolbar(page).getByRole('button', { name: 'Play', exact: true })
  await expect(play).toBeEnabled({ timeout: 45_000 })

  await page.keyboard.press('Space')
  await expect(toolbar(page).getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await expect(page.locator('.at-wrap')).toHaveAttribute('data-cursor', 'on')
  await page.keyboard.press('Space')
  await expect(play).toBeVisible()
  await page.keyboard.press('s')
  await expect(play).toBeVisible()

  const metronome = toolbar(page).getByRole('button', { name: 'Metronome' })
  await expect(metronome).toHaveAttribute('aria-pressed', 'false')
  await page.keyboard.press('m')
  await expect(metronome).toHaveAttribute('aria-pressed', 'true')
})

test(', and . change the playback speed and \\ resets it', async ({ page }) => {
  await openApp(page)
  await expect(toolbar(page).getByRole('button', { name: 'Play', exact: true })).toBeEnabled({ timeout: 45_000 })
  await page.keyboard.press(',')
  await expect(toolbar(page).getByRole('button', { name: 'Playback speed 95%' })).toBeVisible()
  await page.keyboard.press('.')
  await page.keyboard.press('.')
  await expect(toolbar(page).getByRole('button', { name: 'Playback speed 105%' })).toBeVisible()
  await page.keyboard.press('\\')
  await expect(toolbar(page).getByRole('button', { name: 'Playback speed 100%' })).toBeVisible()
})
