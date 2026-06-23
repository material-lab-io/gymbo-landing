import { StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import './index.css'
import { ArticlePage } from './pages/ArticlePage'
import { postBySlug } from './content/blog/posts'

// Shared entry for every /blog/<slug>/ post — resolves the post from the path,
// so a new post needs no new entry file.
const slug = location.pathname.replace(/^\/blog\//, '').replace(/\/$/, '')
const post = postBySlug(slug)
const root = document.getElementById('root')!
if (post) {
  hydrateRoot(root, <StrictMode><ArticlePage post={post} /></StrictMode>)
}
