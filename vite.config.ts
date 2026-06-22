import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
  build: {
    rollupOptions: {
      input: {
        // homepage
        main: resolve(root, 'index.html'),
        // static comparison pages (real HTML per route → SEO meta + schema baked in)
        compareWellnessz: resolve(root, 'compare/gymbo-vs-wellnessz/index.html'),
      },
    },
  },
})
