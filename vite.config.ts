import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { alphaTab } from '@coderline/alphatab-vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import istanbul from 'vite-plugin-istanbul'
import { configDefaults, defineConfig } from 'vitest/config'

// Shown in the help dialog. Falls back when building outside a git checkout.
function gitSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return process.env.GITHUB_SHA?.slice(0, 7) ?? 'unknown'
  }
}

// What coverage is measured over, by unit and end-to-end runs alike (see
// scripts/coverage-report.mjs). components/ui/ is generated shadcn code.
const COVERAGE_INCLUDE = ['src/**/*.{ts,tsx}']
const COVERAGE_EXCLUDE = ['src/components/ui/**', 'src/**/*.d.ts']

// `npm run coverage:e2e` builds with E2E_COVERAGE set, so the app counts what
// the end-to-end tests run. Added only then: the plugin turns on source maps
// even when idle.
const e2eCoverage = process.env.E2E_COVERAGE
  ? [
      istanbul({
        include: COVERAGE_INCLUDE,
        exclude: COVERAGE_EXCLUDE,
        extension: ['.ts', '.tsx'],
        forceBuildInstrument: true,
      }),
    ]
  : []

// https://vite.dev/config/
export default defineConfig({
  // alphaTab() must come first: its plugins are `enforce: 'pre'` and need to
  // see alphaTab's worker/worklet imports before anything else transforms them.
  plugins: [alphaTab(), react(), tailwindcss(), ...e2eCoverage],
  define: {
    'import.meta.env.VITE_GIT_SHA': JSON.stringify(gitSha()),
    'import.meta.env.VITE_BUILD_TIME': JSON.stringify(new Date().toISOString()),
  },
  resolve: {
    alias: {
      // This config is ESM ("type": "module"), so __dirname does not exist.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // tests/e2e/ holds Playwright specs, run by `npm run test:e2e`; .claude/
    // holds tool fixtures that are not this project's tests.
    exclude: [...configDefaults.exclude, 'tests/e2e/**', '.claude/**'],
    // Istanbul rather than V8, so unit and end-to-end coverage count the same
    // statements and can be merged.
    coverage: {
      provider: 'istanbul',
      include: COVERAGE_INCLUDE,
      exclude: COVERAGE_EXCLUDE,
      reporter: ['json', 'text-summary'],
      reportsDirectory: 'coverage/unit',
    },
  },
})
