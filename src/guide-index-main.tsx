import { StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import './index.css'
import { GuideIndex } from './pages/GuideIndex'

hydrateRoot(
  document.getElementById('root')!,
  <StrictMode>
    <GuideIndex />
  </StrictMode>,
)
