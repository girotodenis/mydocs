import { useState, type FormEvent } from 'react'
import { AlertTriangle, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { Modal } from '@/presentation/components/Modal'
import { useVault } from '@/presentation/app/providers/vaultProvider'

/**
 * Aparece quando o Google Drive já tem um cofre que não abre com a senha do
 * cofre local. Oferece abrir o cofre do Drive com a senha correta (o conteúdo
 * local deixa de ser exibido) ou criar um cofre novo, renomeando a pasta antiga
 * para guardá-la como backup.
 */
export function SincronizacaoModal() {
  const vault = useVault()
  const [senha, setSenha] = useState('')
  const [acao, setAcao] = useState<'entrar' | 'criar' | null>(null)

  if (!vault.conflito) return null

  async function entrarComSenha(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!senha.trim() || acao) return
    setAcao('entrar')
    try {
      await vault.usarCofreDoDrive(senha)
      setSenha('')
    } catch {
      /* a mensagem aparece em vault.erro */
    } finally {
      setAcao(null)
    }
  }

  async function criarNovo() {
    if (acao) return
    if (
      !window.confirm(
        'Criar um cofre novo no Drive? O cofre antigo não será apagado: a pasta dele será renomeada e mantida como backup.',
      )
    ) {
      return
    }
    setAcao('criar')
    try {
      await vault.criarNovoCofreNoDrive()
    } catch {
      /* a mensagem aparece em vault.erro */
    } finally {
      setAcao(null)
    }
  }

  return (
    <Modal aberto titulo="Já existe um cofre no Google Drive" onFechar={vault.limparConflito} largura="md">
      <div className="space-y-4 text-sm text-slate-700 dark:text-slate-300">
        <p className="flex gap-2 rounded-lg bg-amber-50 p-3 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            O cofre do Google Drive foi criado em outro dispositivo e usa uma <strong>chave diferente</strong> desta
            (mesmo que a senha seja a mesma, cada cofre tem seu próprio salt). Escolha como continuar:
          </span>
        </p>

        <form onSubmit={(event) => void entrarComSenha(event)} className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <p className="font-semibold text-slate-900 dark:text-slate-100">1. Abrir o cofre do Drive e juntar tudo</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Informe a senha do cofre do Drive (pode ser a mesma que você usa aqui). Os arquivos criados neste
            dispositivo são recifrados e enviados — <strong>nada é perdido</strong>.
          </p>
          <input
            type="password"
            value={senha}
            onChange={(event) => setSenha(event.target.value)}
            placeholder="Senha do cofre do Drive"
            autoComplete="current-password"
            aria-label="Senha do cofre do Drive"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          <button
            type="submit"
            disabled={!senha.trim() || acao !== null}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {acao === 'entrar' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
            {acao === 'entrar' ? 'Juntando cofres…' : 'Abrir e juntar com o cofre do Drive'}
          </button>
        </form>

        <div className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <p className="font-semibold text-slate-900 dark:text-slate-100">2. Criar um cofre novo no Drive</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            A pasta do cofre antigo é renomeada e preservada como backup; nada é apagado. Este dispositivo passa a
            sincronizar o cofre atual.
          </p>
          <button
            type="button"
            onClick={() => void criarNovo()}
            disabled={acao !== null}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 disabled:opacity-50 dark:border-red-500/30 dark:text-red-400"
          >
            {acao === 'criar' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
            {acao === 'criar' ? 'Criando…' : 'Criar cofre novo (guardar o antigo)'}
          </button>
        </div>

        {vault.erro ? (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
            {vault.erro}
          </p>
        ) : null}
      </div>
    </Modal>
  )
}
