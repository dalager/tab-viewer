import { fileURLToPath } from 'node:url'
import { alphaTab } from '@coderline/alphatab-vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

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
})
