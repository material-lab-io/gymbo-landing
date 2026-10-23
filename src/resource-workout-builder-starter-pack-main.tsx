import { StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import './index.css'
import { ResourceWorkoutBuilderStarterPack } from './pages/ResourceWorkoutBuilderStarterPack'

hydrateRoot(
  document.getElementById('root')!,
  <StrictMode>
    <ResourceWorkoutBuilderStarterPack />
  </StrictMode>,
)
