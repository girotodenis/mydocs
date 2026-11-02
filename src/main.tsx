import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from '@/presentation/app/App'
import { ThemeProvider } from '@/presentation/app/providers/themeContext'
import { AuthProvider } from '@/presentation/app/providers/authProvider'
import { VaultProvider } from '@/presentation/app/providers/vaultProvider'
import '@/index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <VaultProvider>
          <BrowserRouter basename="/mydocs">
            <App />
          </BrowserRouter>
        </VaultProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)
