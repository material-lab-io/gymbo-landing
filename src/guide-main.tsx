import { StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import './index.css'
import { ArticlePage } from './pages/ArticlePage'
import { guideBySlug, relatedFor } from './content/guide/pillars'

// Shared entry for every /guide/<slug>/ pillar page.
const slug = location.pathname.replace(/^\/guide\//, '').replace(/\/$/, '')
const post = guideBySlug(slug)
const root = document.getElementById('root')!
if (post) {
  hydrateRoot(
    root,
    <StrictMode>
      <ArticlePage post={post} back={{ href: '/guide/', label: '← all guides' }} showDate={false} related={relatedFor(slug)} />
    </StrictMode>,
  )
}
