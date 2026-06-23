import { StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import './index.css'
import { Terms } from './pages/Terms'

hydrateRoot(
  document.getElementById('root')!,
  <StrictMode>
    <Terms />
  </StrictMode>,
)
