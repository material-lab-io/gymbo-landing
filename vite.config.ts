import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))
const SITE = 'https://getgymbo.com'

// Single source of truth for every routed HTML page. Drives BOTH the rollup
// multi-page inputs AND public sitemap.xml — add a page here and it's emitted
// to both. `url` is the canonical (trailing-slash, matching Cloudflare's 308).
const PAGES = [
  { key: 'main', entry: 'index.html', url: '/', priority: '1.0', changefreq: 'weekly' },
  { key: 'compareWellnessz', entry: 'compare/gymbo-vs-wellnessz/index.html', url: '/compare/gymbo-vs-wellnessz/', priority: '0.8', changefreq: 'monthly' },
]

// Emit sitemap.xml from PAGES at build time (replaces the hand-maintained
// public/sitemap.xml so routes can't drift out of sync).
function sitemap(): Plugin {
  return {
    name: 'emit-sitemap',
    generateBundle() {
      const lastmod = new Date().toISOString().slice(0, 10)
      const urls = PAGES.map(
        (p) =>
          `  <url>\n    <loc>${SITE}${p.url}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>`
      ).join('\n')
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
      })
    },
  }
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    sitemap(),
  ],
  build: {
    rollupOptions: {
      input: Object.fromEntries(PAGES.map((p) => [p.key, resolve(root, p.entry)])),
    },
  },
})
