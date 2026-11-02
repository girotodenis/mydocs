import { FolderLock, Moon, Sun, Wallet } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '@/presentation/cn'
import { useTheme } from '@/presentation/app/providers/themeContext'

const navItemClass = 'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all'

export function AppLayout() {
  const { theme, toggle } = useTheme()

  const navItems = [{ to: '/', label: 'Início', icon: FolderLock, end: true }] as const

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
          <div className="flex items-center gap-3">
            <NavLink to="/" className="group flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-600/30 transition-transform group-hover:scale-105">
                <Wallet className="h-5 w-5" aria-hidden />
              </span>
              <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">MyDocs</span>
            </NavLink>
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
            </ul>
          </nav>
        </div>
      </header>

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
