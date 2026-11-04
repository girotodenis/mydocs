import { useEffect, useState } from 'react'
import {
  CloudUpload,
  CloudOff,
  ExternalLink,
  FolderLock,
  Inbox,
  Loader2,
  Lock,
  LogOut,
  Menu,
  Moon,
  Sun,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { ConflitoDeSenhaError } from '@/application/conexao'
import { cn } from '@/presentation/cn'
import { useTheme } from '@/presentation/app/providers/themeContext'
import { useVault } from '@/presentation/app/providers/vaultProvider'
import { SincronizacaoModal } from '@/presentation/components/SincronizacaoModal'
import { useOnlineStatus } from '@/presentation/hooks/useOnlineStatus'

const navItemClass = 'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all'
const navAcaoClass =
  'inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-all hover:bg-brand-50 hover:text-brand-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
const mobileItemClass = 'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors'

type AcaoHeader = {
  key: string
  label: string
  icon: LucideIcon
  href?: string
  onClick?: () => void
  apenasIcone?: boolean
}

export function AppLayout() {
  const { theme, toggle } = useTheme()
  const vault = useVault()
  const online = useOnlineStatus()
  const { pathname } = useLocation()
  const [menuAberto, setMenuAberto] = useState(false)
  const aviso = vault.aviso
  const limparAviso = vault.limparAviso

  useEffect(() => {
    if (!aviso) return
    const timer = window.setTimeout(() => limparAviso(), 8_000)
    return () => window.clearTimeout(timer)
  }, [aviso, limparAviso])

  useEffect(() => {
    setMenuAberto(false)
  }, [pathname])

  const navItems = [
    { to: '/', label: 'Cofre', icon: FolderLock, end: true },
    { to: '/recebidos', label: 'Recebidos', icon: Inbox, end: false },
  ] as const

  const acoes: AcaoHeader[] = []
  if (vault.folderId) {
    acoes.push({
      key: 'drive',
      label: 'Drive',
      icon: ExternalLink,
      href: `https://drive.google.com/drive/folders/${vault.folderId}`,
    })
  }
  if (vault.status === 'pronto') {
    acoes.push({ key: 'bloquear', label: 'Bloquear', icon: Lock, onClick: vault.bloquear })
  }
  acoes.push({
    key: 'tema',
    label: theme === 'dark' ? 'Tema claro' : 'Tema escuro',
    icon: theme === 'dark' ? Sun : Moon,
    onClick: toggle,
    apenasIcone: true,
  })
  if (vault.autenticado) {
    acoes.push({ key: 'sair', label: 'Desconectar Google', icon: LogOut, onClick: vault.logout })
  }

  async function sincronizar() {
    setMenuAberto(false)
    try {
      await vault.sincronizarDrive()
    } catch (e) {
      if (e instanceof ConflitoDeSenhaError) return // o modal de conflito assume
      window.alert(e instanceof Error ? e.message : String(e))
    }
  }

  function conteudoAcao(acao: AcaoHeader) {
    const Icon = acao.icon
    return (
      <>
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        <span className={cn(acao.apenasIcone && 'sm:sr-only')}>{acao.label}</span>
      </>
    )
  }

  return (
    <div className="flex min-h-full flex-col">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Pular para o conteúdo
      </a>

      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <NavLink to="/" className="group flex shrink-0 items-center gap-2 sm:gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-600/30 transition-transform group-hover:scale-105">
                <Wallet className="h-5 w-5" aria-hidden />
              </span>
              <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">MyDocs</span>
            </NavLink>
            {vault.pendentes > 0 ? (
              <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 sm:inline-flex dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                {vault.pendentes} <span className="hidden sm:inline">pendente(s)</span>
              </span>
            ) : null}
            {vault.sincronizado ? (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                <CloudUpload className="h-3.5 w-3.5" aria-hidden />
                <span className="hidden sm:inline">Sincronizado</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => void sincronizar()}
                disabled={vault.sincronizando}
                aria-label="Sincronizar cofre com o Google Drive"
                title="Sincronizar cofre com o Google Drive"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm shadow-red-600/30 transition-colors hover:bg-red-700 disabled:opacity-60"
              >
                {vault.sincronizando ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <CloudOff className="h-3.5 w-3.5" aria-hidden />
                )}
                {vault.sincronizando ? 'Sincronizando…' : 'Não sincronizado'}
              </button>
            )}
          </div>

          <nav aria-label="Navegação principal" className="hidden min-w-0 sm:block">
            <ul className="flex flex-wrap items-center justify-end gap-1">
              {navItems.map(({ to, label, icon: Icon, end }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      cn(
                        navItemClass,
                        isActive
                          ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                          : 'text-slate-600 hover:bg-brand-50 hover:text-brand-700 dark:text-slate-300 dark:hover:bg-slate-800',
                      )
                    }
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    {label}
                  </NavLink>
                </li>
              ))}

              {acoes.map((acao) => (
                <li key={acao.key}>
                  {acao.href ? (
                    <a href={acao.href} target="_blank" rel="noreferrer" className={navAcaoClass}>
                      {conteudoAcao(acao)}
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={acao.onClick}
                      aria-label={acao.apenasIcone ? acao.label : undefined}
                      className={navAcaoClass}
                    >
                      {conteudoAcao(acao)}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          <button
            type="button"
            onClick={() => setMenuAberto((v) => !v)}
            aria-expanded={menuAberto}
            aria-controls="menu-mobile"
            aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition-colors hover:bg-brand-50 hover:text-brand-700 sm:hidden dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {menuAberto ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          </button>
        </div>

        {menuAberto ? (
          <div
            id="menu-mobile"
            className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-slate-200 bg-white px-4 pb-4 pt-2 sm:hidden dark:border-slate-800 dark:bg-slate-900"
          >
            <nav aria-label="Menu">
              <ul className="flex flex-col gap-1">
                {navItems.map(({ to, label, icon: Icon, end }) => (
                  <li key={to}>
                    <NavLink
                      to={to}
                      end={end}
                      className={({ isActive }) =>
                        cn(
                          mobileItemClass,
                          isActive
                            ? 'bg-brand-600 text-white'
                            : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800',
                        )
                      }
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden />
                      {label}
                    </NavLink>
                  </li>
                ))}
              </ul>

              <ul className="mt-2 flex flex-col gap-1 border-t border-slate-100 pt-2 dark:border-slate-800">
                {acoes.map((acao) => (
                  <li key={acao.key}>
                    {acao.href ? (
                      <a
                        href={acao.href}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(
                          mobileItemClass,
                          'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800',
                        )}
                      >
                        {conteudoAcao(acao)}
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuAberto(false)
                          acao.onClick?.()
                        }}
                        className={cn(
                          mobileItemClass,
                          'text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800',
                        )}
                      >
                        {conteudoAcao(acao)}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        ) : null}
      </header>

      {!online && vault.vinculado ? (
        <div className="flex items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          Modo offline — as alterações serão sincronizadas ao reconectar.
        </div>
      ) : null}

      {aviso ? (
        <div
          role="status"
          className="flex items-center justify-center gap-2 border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-center text-sm font-medium text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
        >
          <CloudUpload className="h-4 w-4 shrink-0" aria-hidden />
          {aviso}
        </div>
      ) : null}

      <main id="conteudo" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 focus:outline-none sm:py-8">
        <Outlet />
      </main>

      <SincronizacaoModal />

      <footer className="border-t border-slate-200/70 bg-white/75 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/75">
        <div className="mx-auto max-w-6xl px-4 py-4 text-center text-sm text-slate-500 sm:text-left dark:text-slate-400">
          MyDocs · Cofre pessoal de arquivos criptografados
        </div>
      </footer>
    </div>
  )
}
