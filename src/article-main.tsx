import { StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import './index.css'
import { ArticlePage } from './pages/ArticlePage'
import { postBySlug } from './content/blog/posts'
import { pillarLinks, RESEARCH_LINK } from './content/guide/pillars'

// The live cornerstone post links out to the /guide/ pillar cluster plus the research report.
// Must match entry-server.tsx exactly, or hydration mismatches (React #418/#423).
const CORNERSTONE_SLUG = 'how-india-independent-trainers-run-their-business'

// Shared entry for every /blog/<slug>/ post — resolves the post from the path,
// so a new post needs no new entry file.
const slug = location.pathname.replace(/^\/blog\//, '').replace(/\/$/, '')
const post = postBySlug(slug)
const root = document.getElementById('root')!
if (post) {
  const related = slug === CORNERSTONE_SLUG ? [...pillarLinks(), RESEARCH_LINK] : undefined
  hydrateRoot(root, <StrictMode><ArticlePage post={post} related={related} /></StrictMode>)
}
