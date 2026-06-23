import { StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import './index.css'
import { ArticlePage } from './pages/ArticlePage'
import { alternativeBySlug } from './content/alternatives/pages'

// Shared entry for every /alternatives/<slug>/ comparison page.
const slug = location.pathname.replace(/^\/alternatives\//, '').replace(/\/$/, '')
const post = alternativeBySlug(slug)
const root = document.getElementById('root')!
if (post) {
  hydrateRoot(
    root,
    <StrictMode>
      <ArticlePage post={post} back={{ href: '/', label: '← gymbo' }} showDate={false} />
    </StrictMode>,
  )
}
