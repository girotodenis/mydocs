import { ExternalLink, FolderLock, Inbox, Lock, LogOut, Moon, Sun, Wallet } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '@/presentation/cn'
import { useTheme } from '@/presentation/app/providers/themeContext'
import { useVault } from '@/presentation/app/providers/vaultProvider'
import { useOnlineStatus } from '@/presentation/hooks/useOnlineStatus'

const navItemClass = 'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all'

export function AppLayout() {
  const { theme, toggle } = useTheme()
  const vault = useVault()
  const online = useOnlineStatus()

  const navItems = [
    { to: '/', label: 'Cofre', icon: FolderLock, end: true },
    { to: '/recebidos', label: 'Recebidos', icon: Inbox, end: false },
  ] as const

  return (
    <div className="flex min-h-full flex-col">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Pular para o conteúdo
      </a>

      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/75 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/75">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <NavLink to="/" className="group flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-600/30 transition-transform group-hover:scale-105">
                <Wallet className="h-5 w-5" aria-hidden />
              </span>
              <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">MyDocs</span>
            </NavLink>
            {vault.pendentes > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                {vault.pendentes} pendente(s)
              </span>
            ) : null}
            {vault.status === 'pronto' ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                Protegido
              </span>
            ) : null}
          </div>

          <nav aria-label="Navegação principal">
            <ul className="flex flex-wrap items-center gap-1">
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

              {vault.folderId ? (
                <li>
                  <a
                    href={`https://drive.google.com/drive/folders/${vault.folderId}`}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      navItemClass,
                      'border border-slate-200 text-slate-600 hover:bg-brand-50 hover:text-brand-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800',
                    )}
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden />
                    Drive
                  </a>
                </li>
              ) : null}

              {vault.status === 'pronto' ? (
                <li>
                  <button
                    type="button"
                    onClick={vault.bloquear}
                    className={cn(
                      navItemClass,
                      'border border-slate-200 text-slate-600 hover:bg-brand-50 hover:text-brand-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800',
                    )}
                  >
                    <Lock className="h-4 w-4" aria-hidden />
                    Bloquear
                  </button>
                </li>
              ) : null}

              <li>
                <button
                  type="button"
                  onClick={toggle}
                  aria-label={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
                  className={cn(
                    navItemClass,
                    'border border-slate-200 text-slate-600 hover:bg-brand-50 hover:text-brand-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800',
                  )}
                >
                  {theme === 'dark' ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
                </button>
              </li>

              {vault.autenticado ? (
                <li>
                  <button
                    type="button"
                    onClick={vault.logout}
                    className={cn(
                      navItemClass,
                      'border border-slate-200 text-slate-600 hover:bg-brand-50 hover:text-brand-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800',
                    )}
                  >
                    <LogOut className="h-4 w-4" aria-hidden />
                    Sair
                  </button>
                </li>
              ) : null}
            </ul>
          </nav>
        </div>
      </header>

      {!online && vault.autenticado ? (
        <div className="flex items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          Modo offline — as alterações serão sincronizadas ao reconectar.
        </div>
      ) : null}

      {vault.sessaoExpirada && vault.autenticado && online ? (
        <div className="flex flex-wrap items-center justify-center gap-3 border-b border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          <span>Sessão com o Google expirada.</span>
          <button
            type="button"
            onClick={() => void vault.relogar()}
            className="rounded-full bg-red-600 px-4 py-1 text-xs font-bold text-white shadow-sm"
          >
            Entrar novamente
          </button>
        </div>
      ) : null}

      <main id="conteudo" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 focus:outline-none">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200/70 bg-white/75 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/75">
        <div className="mx-auto max-w-6xl px-4 py-4 text-sm text-slate-500 dark:text-slate-400">
          MyDocs · Cofre pessoal de arquivos criptografados
        </div>
      </footer>
    </div>
  )
}
