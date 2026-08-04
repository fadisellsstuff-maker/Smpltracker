import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { App } from './App'
import { SettingsProvider } from './SettingsContext'
import { PersonaProvider } from './persona'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <PersonaProvider>
        <SettingsProvider>
          <App />
        </SettingsProvider>
      </PersonaProvider>
    </BrowserRouter>
  </StrictMode>,
)
