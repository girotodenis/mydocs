import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

const SCOPES = 'https://www.googleapis.com/auth/drive.file'
const TOKEN_KEY = 'mydocs:token'
const USER_KEY = 'mydocs:user'
const EXPIRA_KEY = 'mydocs:token:expiraEm'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

interface TokenResponse {
  error?: string
  access_token?: string
  expires_in?: number
}

interface TokenClient {
  requestAccessToken(): void
}

interface GoogleOAuth2 {
  initTokenClient(config: {
    client_id: string
    scope: string
    callback: (resp: TokenResponse) => void
    error_callback?: (erro: { type?: string; message?: string }) => void
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
  garantirToken(): Promise<string>
  renovarToken(): Promise<string>
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

function extrairExp(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as { exp?: number }
    return payload.exp ?? 0
  } catch {
    return 0
  }
}

/**
 * Margem de segurança (60 s) para renovar antes do token expirar de fato.
 *
 * Os tokens do Google Identity Services são opacos (não são JWT), então a
 * expiração vem de `expires_in` e é guardada junto com o token. O fallback por
 * `exp` cobre tokens em formato JWT (usado em testes).
 */
export function tokenExpirado(token: string): boolean {
  const expiraEm = Number(localStorage.getItem(EXPIRA_KEY))
  if (Number.isFinite(expiraEm) && expiraEm > 0) return Date.now() >= expiraEm - 60_000
  const exp = extrairExp(token)
  if (!exp) return false
  return Date.now() >= exp * 1000 - 60_000
}

interface TokenNovo {
  accessToken: string
  expiraEm: number
}

async function solicitarTokenNovo(google: GoogleNamespace): Promise<TokenNovo> {
  return new Promise<TokenNovo>((resolve, reject) => {
    let concluido = false
    const finalizar = (fn: () => void) => {
      if (concluido) return
      concluido = true
      window.clearTimeout(timer)
      fn()
    }
    // Se o popup for bloqueado/fechado, o callback nunca é chamado: não deixa a
    // UI presa em "Sincronizando…".
    const timer = window.setTimeout(
      () => finalizar(() => reject(new Error('Tempo esgotado ao entrar no Google. Tente novamente.'))),
      120_000,
    )

    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID!,
      scope: SCOPES,
      callback: (resp) => {
        if (resp.error) {
          finalizar(() => reject(new Error(resp.error)))
          return
        }
        if (!resp.access_token) {
          finalizar(() => reject(new Error('Sem token de acesso')))
          return
        }
        const segundos = resp.expires_in && resp.expires_in > 0 ? resp.expires_in : 3600
        finalizar(() =>
          resolve({ accessToken: resp.access_token!, expiraEm: Date.now() + segundos * 1000 }),
        )
      },
      error_callback: (erro) => {
        finalizar(() =>
          reject(new Error(erro?.message || 'Não foi possível abrir a janela de login do Google.')),
        )
      },
    })
    tokenClient.requestAccessToken()
  })
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
  const [email, setEmail] = useState<string | null>(() => localStorage.getItem(USER_KEY))
  const tokenRef = useRef<string | null>(token)
  tokenRef.current = token
  const requisicaoTokenRef = useRef<Promise<string> | null>(null)

  const gravarToken = useCallback(({ accessToken, expiraEm }: TokenNovo) => {
    tokenRef.current = accessToken
    localStorage.setItem(TOKEN_KEY, accessToken)
    localStorage.setItem(EXPIRA_KEY, String(expiraEm))
    const userEmail = extrairEmail(accessToken)
    localStorage.setItem(USER_KEY, userEmail)
    setToken(accessToken)
    setEmail(userEmail)
  }, [])

  const login = useCallback(async () => {
    if (!CLIENT_ID) throw new Error('VITE_GOOGLE_CLIENT_ID não configurado')
    const google = await carregarGis()
    gravarToken(await solicitarTokenNovo(google))
  }, [gravarToken])

  const logout = useCallback(() => {
    tokenRef.current = null
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(EXPIRA_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setEmail(null)
  }, [])

  const tokenProvider = useCallback(async () => {
    const t = tokenRef.current
    if (!t) throw new Error('Não autenticado')
    return t
  }, [])

  /**
   * Retorna um token válido. Se o token atual expirou (ou não existe), pede um
   * novo ao Google — o prompt só aparece quando o consentimento precisar ser
   * renovado; caso contrário, a renovação é silenciosa.
   *
   * Chamadas concorrentes reaproveitam a mesma requisição para não abrir dois
   * popups de login.
   */
  const garantirToken = useCallback(async () => {
    const t = tokenRef.current
    if (t && !tokenExpirado(t)) return t
    if (!CLIENT_ID) throw new Error('VITE_GOOGLE_CLIENT_ID não configurado')
    if (!requisicaoTokenRef.current) {
      requisicaoTokenRef.current = (async () => {
        const google = await carregarGis()
        const novo = await solicitarTokenNovo(google)
        gravarToken(novo)
        return novo.accessToken
      })().finally(() => {
        requisicaoTokenRef.current = null
      })
    }
    return requisicaoTokenRef.current
  }, [gravarToken])

  /**
   * Renova o token ignorando o cache — usado quando o Drive responde 401
   * (token revogado/expirado sem que a expiração local fosse conhecida).
   */
  const renovarToken = useCallback(async () => {
    if (!CLIENT_ID) throw new Error('VITE_GOOGLE_CLIENT_ID não configurado')
    if (!requisicaoTokenRef.current) {
      requisicaoTokenRef.current = (async () => {
        const google = await carregarGis()
        const novo = await solicitarTokenNovo(google)
        gravarToken(novo)
        return novo.accessToken
      })().finally(() => {
        requisicaoTokenRef.current = null
      })
    }
    return requisicaoTokenRef.current
  }, [gravarToken])

  return (
    <AuthContext.Provider
      value={{
        token,
        email,
        configurado: Boolean(CLIENT_ID),
        login,
        logout,
        tokenProvider,
        garantirToken,
        renovarToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
