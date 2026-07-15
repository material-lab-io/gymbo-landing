import { StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import './index.css'
import { ArticlePage } from './pages/ArticlePage'
import { postBySlug } from './content/blog/posts'
import { pillarLinks } from './content/guide/pillars'

// The live cornerstone post links out to the /guide/ pillar cluster.
const CORNERSTONE_SLUG = 'how-india-independent-trainers-run-their-business'

// Shared entry for every /blog/<slug>/ post — resolves the post from the path,
// so a new post needs no new entry file.
const slug = location.pathname.replace(/^\/blog\//, '').replace(/\/$/, '')
const post = postBySlug(slug)
const root = document.getElementById('root')!
if (post) {
  const related = slug === CORNERSTONE_SLUG ? pillarLinks() : undefined
  hydrateRoot(root, <StrictMode><ArticlePage post={post} related={related} /></StrictMode>)
}
