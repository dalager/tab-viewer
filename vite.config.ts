import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { alphaTab } from '@coderline/alphatab-vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
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

// https://vite.dev/config/
export default defineConfig({
  // alphaTab() must come first: its plugins are `enforce: 'pre'` and need to
  // see alphaTab's worker/worklet imports before anything else transforms them.
  plugins: [alphaTab(), react(), tailwindcss()],
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
  },
})
