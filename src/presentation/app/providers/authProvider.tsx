import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

const SCOPES = 'https://www.googleapis.com/auth/drive.file'
const TOKEN_KEY = 'mydocs:token'
const USER_KEY = 'mydocs:user'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

interface TokenResponse {
  error?: string
  access_token?: string
}

interface TokenClient {
  requestAccessToken(): void
}

interface GoogleOAuth2 {
  initTokenClient(config: {
    client_id: string
    scope: string
    callback: (resp: TokenResponse) => void
  }): TokenClient
}

interface GoogleNamespace {
  accounts: {
    oauth2: GoogleOAuth2
  }
}

declare global {
  interface Window {
    google?: GoogleNamespace
  }
}

interface AuthContextValue {
  token: string | null
  email: string | null
  configurado: boolean
  login(): Promise<void>
  logout(): void
  tokenProvider(): Promise<string>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function carregarGis(): Promise<GoogleNamespace> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts) {
      resolve(window.google)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = () => {
      if (window.google?.accounts) resolve(window.google)
      else reject(new Error('Falha ao carregar o Google Identity Services'))
    }
    script.onerror = () => reject(new Error('Falha ao carregar o Google Identity Services'))
    document.head.appendChild(script)
  })
}

function extrairEmail(token: string): string {
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as { email?: string }
    return payload.email ?? ''
  } catch {
    return ''
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
  const [email, setEmail] = useState<string | null>(() => localStorage.getItem(USER_KEY))
  const tokenRef = useRef<string | null>(token)
  tokenRef.current = token

  const login = useCallback(async () => {
    if (!CLIENT_ID) throw new Error('VITE_GOOGLE_CLIENT_ID não configurado')
    const google = await carregarGis()
    await new Promise<void>((resolve, reject) => {
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (resp) => {
          if (resp.error) {
            reject(new Error(resp.error))
            return
          }
          if (!resp.access_token) {
            reject(new Error('Sem token de acesso'))
            return
          }
          localStorage.setItem(TOKEN_KEY, resp.access_token)
          const userEmail = extrairEmail(resp.access_token)
          localStorage.setItem(USER_KEY, userEmail)
          setToken(resp.access_token)
          setEmail(userEmail)
          resolve()
        },
      })
      tokenClient.requestAccessToken()
    })
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setEmail(null)
  }, [])

  const tokenProvider = useCallback(async () => {
    const t = tokenRef.current
    if (!t) throw new Error('Não autenticado')
    return t
  }, [])

  return (
    <AuthContext.Provider value={{ token, email, configurado: Boolean(CLIENT_ID), login, logout, tokenProvider }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
