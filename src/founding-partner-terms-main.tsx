import { StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import './index.css'
import { FoundingPartnerTerms } from './pages/FoundingPartnerTerms'

hydrateRoot(
  document.getElementById('root')!,
  <StrictMode>
    <FoundingPartnerTerms />
  </StrictMode>,
)
