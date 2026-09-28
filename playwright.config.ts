import { defineConfig, devices } from '@playwright/test'

// End-to-end tests drive the real app in Chromium. They run against a
// production build served by `vite preview`: the dev server re-optimizes
// dependencies under parallel first loads and reloads pages mid-load, which
// loses the first-visit songbook. `npm run test:e2e` runs them; `npm test`
// (vitest) leaves them alone.
//
// In CI the workflow builds dist/ in its own step first (see
// .github/workflows/deploy.yml), so the tests serve that build as it is.
const CI = !!process.env.CI

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  // alphaTab renders in a worker per page; more than this and pages starve.
  workers: CI ? 2 : 4,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    permissions: ['clipboard-read', 'clipboard-write'],
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `${CI ? '' : 'npm run build && '}npm run preview -- --port 4173 --strictPort`,
    url: 'http://localhost:4173',
    reuseExistingServer: !CI,
    timeout: 300_000,
  },
})
