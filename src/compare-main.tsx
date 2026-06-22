import { StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import './index.css'
import { CompareWellnessZ } from './pages/CompareWellnessZ'

// Body is prerendered (scripts/prerender.mjs) → hydrate rather than re-render.
hydrateRoot(
  document.getElementById('root')!,
  <StrictMode>
    <CompareWellnessZ />
  </StrictMode>,
)
