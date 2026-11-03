import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Inbox, LockKeyhole, LogIn } from 'lucide-react'
import { useVault } from '@/presentation/app/providers/vaultProvider'

export function RecebidosPage() {
  const vault = useVault()
  const { status, processarRecebidos } = vault
  const [mensagem, setMensagem] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [senha, setSenha] = useState('')
  const [desbloqueando, setDesbloqueando] = useState(false)
  const importouRef = useRef(false)

  const processar = useCallback(async () => {
    if (status !== 'pronto') return
    setCarregando(true)
    try {
      const n = await processarRecebidos(null)
      setMensagem(n > 0 ? `${n} arquivo(s) importado(s) para a raiz.` : 'Nenhum arquivo recebido pendente.')
    } catch (e) {
      setMensagem(e instanceof Error ? e.message : String(e))
    } finally {
      setCarregando(false)
    }
  }, [status, processarRecebidos])

  async function desbloquear(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setDesbloqueando(true)
    setMensagem('')
    try {
      if (vault.status === 'bloqueado') {
        await vault.desbloquear(senha)
      } else {
        await vault.entrarNoCofre(senha)
      }
    } catch (erro) {
      setMensagem(erro instanceof Error ? erro.message : String(erro))
    } finally {
      setSenha('')
      setDesbloqueando(false)
    }
  }

  async function entrar() {
    setDesbloqueando(true)
    setMensagem('')
    try {
      await vault.login()
    } catch (erro) {
      setMensagem(erro instanceof Error ? erro.message : String(erro))
    } finally {
      setDesbloqueando(false)
    }
  }

  useEffect(() => {
    if (vault.status !== 'pronto') {
      importouRef.current = false
      return
    }
    if (!importouRef.current) {
      importouRef.current = true
      void processar()
    }
  }, [vault.status, processar])

  return (
    <div className="mx-auto max-w-md text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-600/30">
        <Inbox className="h-7 w-7" aria-hidden />
      </span>
      <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-slate-100">Recebidos</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Arquivos, textos e links compartilhados são importados automaticamente para a raiz do cofre.
      </p>
      {!vault.configurado ? (
        <p className="mt-6 text-sm text-slate-600 dark:text-slate-300">O acesso ao Google Drive ainda não está configurado.</p>
      ) : !vault.autenticado ? (
        <button
          type="button"
          disabled={desbloqueando}
          onClick={() => void entrar()}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          <LogIn className="h-4 w-4" aria-hidden />
          Entrar com Google
        </button>
      ) : vault.status !== 'pronto' ? (
        <form onSubmit={(event) => void desbloquear(event)} className="mt-6 text-left">
          <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
            Desbloqueie o cofre para importar o conteúdo compartilhado. Ele permanece pendente até o desbloqueio.
          </p>
          <label htmlFor="senha-recebidos" className="text-sm font-semibold text-slate-900 dark:text-slate-100">Senha do cofre</label>
          <input
            id="senha-recebidos"
            type="password"
            autoComplete="current-password"
            required
            disabled={desbloqueando}
            value={senha}
            onChange={(event) => setSenha(event.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          <button
            type="submit"
            disabled={desbloqueando || !senha}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            <LockKeyhole className="h-4 w-4" aria-hidden />
            {desbloqueando ? 'Desbloqueando…' : 'Desbloquear e importar'}
          </button>
        </form>
      ) : <button
        type="button"
        disabled={carregando}
        onClick={() => void processar()}
        className="mt-6 rounded-full bg-brand-600 px-6 py-2 text-sm font-bold text-white shadow-md shadow-brand-600/30"
      >
        {carregando ? 'Importando…' : 'Importar agora'}
      </button>}
      {vault.erro ? <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-300">{vault.erro}</p> : null}
      {mensagem ? <p role="status" className="mt-4 text-sm text-slate-600 dark:text-slate-300">{mensagem}</p> : null}
    </div>
  )
}
