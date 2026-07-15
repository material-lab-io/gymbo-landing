import { StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import './index.css'
import { ArticlePage } from './pages/ArticlePage'
import { reportBySlug, reportRelated } from './content/research/reports'

// Shared entry for every /research/<slug>/ data report.
const slug = location.pathname.replace(/^\/research\//, '').replace(/\/$/, '')
const post = reportBySlug(slug)
const root = document.getElementById('root')!
if (post) {
  hydrateRoot(
    root,
    <StrictMode>
      <ArticlePage post={post} back={{ href: '/', label: '← gymbo' }} showDate={false} related={reportRelated(slug)} />
    </StrictMode>,
  )
}
