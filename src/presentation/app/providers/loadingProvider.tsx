import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

interface LoadingContextValue {
  /** Executa `fn` exibindo um overlay com `mensagem` até a conclusão. */
  comCarregando<T>(mensagem: string, fn: () => Promise<T>): Promise<T>
  carregando: boolean
}

const LoadingContext = createContext<LoadingContextValue | null>(null)

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [ativo, setAtivo] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const contador = useRef(0)

  const comCarregando = useCallback(async <T,>(msg: string, fn: () => Promise<T>): Promise<T> => {
    contador.current += 1
    setMensagem(msg)
    setAtivo(true)
    try {
      return await fn()
    } finally {
      contador.current -= 1
      if (contador.current <= 0) {
        contador.current = 0
        setAtivo(false)
        setMensagem('')
      }
    }
  }, [])

  return (
    <LoadingContext.Provider value={{ comCarregando, carregando: ativo }}>
      {children}
      {ativo ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
        >
          <div className="flex min-w-56 flex-col items-center gap-3 rounded-2xl bg-white px-6 py-5 text-center text-slate-800 shadow-xl dark:bg-slate-800 dark:text-slate-100">
            <Loader2 className="h-8 w-8 animate-spin text-brand-600" aria-hidden />
            <p className="text-sm font-medium">{mensagem}</p>
          </div>
        </div>
      ) : null}
    </LoadingContext.Provider>
  )
}

export function useLoading(): LoadingContextValue {
  const ctx = useContext(LoadingContext)
  if (!ctx) throw new Error('useLoading deve ser usado dentro de LoadingProvider')
  return ctx
}
