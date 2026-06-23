import { StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import './index.css'
import { Privacy } from './pages/Privacy'

hydrateRoot(
  document.getElementById('root')!,
  <StrictMode>
    <Privacy />
  </StrictMode>,
)
