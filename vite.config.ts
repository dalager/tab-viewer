import { fileURLToPath } from 'node:url'
import { alphaTab } from '@coderline/alphatab-vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  // alphaTab() must come first: its plugins are `enforce: 'pre'` and need to
  // see alphaTab's worker/worklet imports before anything else transforms them.
  plugins: [alphaTab(), react(), tailwindcss()],
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
