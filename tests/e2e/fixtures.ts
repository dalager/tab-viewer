// The suite's `test`, which also records coverage when `npm run coverage:e2e`
// builds the app instrumented (E2E_COVERAGE). Specs import `test` and
// `expect` from here rather than from @playwright/test.
//
// The instrumented app counts into window.__coverage__, which a reload or a
// navigation throws away. So each page stashes its counts in sessionStorage
// as it unloads (synchronously: a message sent from a page on its way out is
// dropped), and the counts of every page the tab showed are gathered at the
// end of the test, the live page's included.

import fs from 'node:fs'
import path from 'node:path'
import { test as base, expect, type Page } from '@playwright/test'
import libCoverage from 'istanbul-lib-coverage'

export const E2E_COVERAGE_DIR = path.resolve(import.meta.dirname, '../../coverage/e2e')

/** Prefix of the sessionStorage keys holding the counts of pages already left. */
const STASH = '__coverage__:'

type Coverage = libCoverage.CoverageMapData

/** The live page's counts and those stashed by the pages before it in the tab. */
function countsIn(page: Page): Promise<Coverage[]> {
  return page
    .evaluate((stash) => {
      const found: string[] = []
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)
        if (key?.startsWith(stash)) found.push(sessionStorage.getItem(key) ?? 'null')
      }
      const live = (window as { __coverage__?: unknown }).__coverage__
      return [...found.map((json) => JSON.parse(json)), live].filter(Boolean)
    }, STASH)
    .catch(() => [])
}

export const test = base.extend<{ coverage: void }>({
  coverage: [
    async ({ context }, use, testInfo) => {
      if (!process.env.E2E_COVERAGE) return use()

      await context.addInitScript((stash) => {
        addEventListener('pagehide', () => {
          const live = (window as { __coverage__?: unknown }).__coverage__
          if (live) sessionStorage.setItem(stash + performance.timeOrigin, JSON.stringify(live))
        })
      }, STASH)

      await use()

      const map = libCoverage.createCoverageMap({})
      for (const page of context.pages()) {
        for (const counts of await countsIn(page)) map.merge(counts)
      }
      fs.mkdirSync(E2E_COVERAGE_DIR, { recursive: true })
      fs.writeFileSync(path.join(E2E_COVERAGE_DIR, `${testInfo.testId}.json`), JSON.stringify(map.toJSON()))
    },
    { auto: true },
  ],
})

export { expect }
export type { Page } from '@playwright/test'
