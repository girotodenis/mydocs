import { FolderLock } from 'lucide-react'

export function HomePage() {
  return (
    <section className="mx-auto max-w-2xl text-center">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-600/30">
        <FolderLock className="h-8 w-8" aria-hidden />
      </span>
      <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">MyDocs</h1>
      <p className="mt-3 text-slate-600 dark:text-slate-400">
        Cofre pessoal de arquivos criptografados no Google Drive. A implementação será construída em fases — esta tela
        é o ponto de partida do app shell.
      </p>
    </section>
  )
}
