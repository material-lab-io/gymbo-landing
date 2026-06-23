import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ROUTES } from './src/routes'
import { POSTS } from './src/content/blog/posts'

const root = fileURLToPath(new URL('.', import.meta.url))
const SITE = 'https://getgymbo.com'

function xmlEscape(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Emit rss.xml from the blog posts (newest first).
function rss(): Plugin {
  return {
    name: 'emit-rss',
    generateBundle() {
      const posts = [...POSTS].sort((a, b) => (a.date < b.date ? 1 : -1))
      const items = posts
        .map((p) => {
          const url = `${SITE}/blog/${p.slug}/`
          const pub = new Date(`${p.date}T08:00:00Z`).toUTCString()
          return `    <item>\n      <title>${xmlEscape(p.title)}</title>\n      <link>${url}</link>\n      <guid isPermaLink="true">${url}</guid>\n      <pubDate>${pub}</pubDate>\n      <description>${xmlEscape(p.dek)}</description>\n    </item>`
        })
        .join('\n')
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n  <channel>\n    <title>The Gymbo blog</title>\n    <link>${SITE}/blog/</link>\n    <description>Practical guides for independent personal trainers in India.</description>\n    <language>en</language>\n${items}\n  </channel>\n</rss>\n`
      this.emitFile({ type: 'asset', fileName: 'rss.xml', source: xml })
    },
  }
}

// Emit sitemap.xml from ROUTES at build time (replaces a hand-maintained
// public/sitemap.xml so routes can't drift out of sync).
function sitemap(): Plugin {
  return {
    name: 'emit-sitemap',
    generateBundle() {
      const lastmod = new Date().toISOString().slice(0, 10)
      const urls = ROUTES.map(
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

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [
    tailwindcss(),
    react(),
    // sitemap only belongs to the client build; the SSR build (--ssr) is a
    // throwaway bundle consumed by scripts/prerender.mjs.
    ...(isSsrBuild ? [] : [sitemap(), rss()]),
  ],
  // react-device-mockup ships extensionless relative imports that native Node
  // ESM can't resolve — bundle it into the SSR output instead of externalizing.
  ssr: {
    noExternal: ['react-device-mockup'],
  },
  build: isSsrBuild
    ? {}
    : {
        rollupOptions: {
          input: Object.fromEntries(ROUTES.map((r) => [r.key, resolve(root, r.entry)])),
        },
      },
}))
