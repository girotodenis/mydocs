import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/presentation/cn'

type ModalProps = {
  aberto: boolean
  titulo: string
  onFechar: () => void
  children: ReactNode
  acoes?: ReactNode
  largura?: 'md' | 'lg' | 'xl'
}

const larguras: Record<NonNullable<ModalProps['largura']>, string> = {
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-3xl',
  xl: 'sm:max-w-5xl',
}

export function Modal({ aberto, titulo, onFechar, children, acoes, largura = 'lg' }: ModalProps) {
  const tituloId = useId()
  const fecharRef = useRef<HTMLButtonElement>(null)
  const onFecharRef = useRef(onFechar)

  useEffect(() => {
    onFecharRef.current = onFechar
  }, [onFechar])

  useEffect(() => {
    if (!aberto) return
    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const foco = window.setTimeout(() => fecharRef.current?.focus(), 0)
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onFecharRef.current()
    }
    document.addEventListener('keydown', aoTeclar)
    return () => {
      window.clearTimeout(foco)
      document.body.style.overflow = overflowAnterior
      document.removeEventListener('keydown', aoTeclar)
    }
  }, [aberto])

  if (!aberto) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-stretch justify-center bg-slate-950/60 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) onFechar()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className={cn(
          'flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-900',
          'sm:h-auto sm:max-h-[90vh] sm:rounded-2xl sm:border sm:border-slate-200 sm:dark:border-slate-800',
          larguras[largura],
        )}
      >
        <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2 id={tituloId} className="min-w-0 flex-1 truncate text-base font-semibold text-slate-900 dark:text-slate-100">
            {titulo}
          </h2>
          <button
            ref={fecharRef}
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="-mr-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>

        {acoes ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-2 dark:border-slate-800">{acoes}</div>
        ) : null}

        <div className="flex-1 overflow-y-auto overscroll-contain p-4">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
