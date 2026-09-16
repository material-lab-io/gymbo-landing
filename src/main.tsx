import { StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { captureAttribution } from './lib/attribution'

// gy-0v33y: classify the arrival BEFORE React renders, so a client-side
// navigation away from the tagged landing URL cannot lose the token.
captureAttribution()

// Body is prerendered (scripts/prerender.mjs) → hydrate rather than re-render.
hydrateRoot(
  document.getElementById('root')!,
  <StrictMode>
    <App />
  </StrictMode>,
)
