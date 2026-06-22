import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { CompareWellnessZ } from './pages/CompareWellnessZ'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CompareWellnessZ />
  </StrictMode>,
)
