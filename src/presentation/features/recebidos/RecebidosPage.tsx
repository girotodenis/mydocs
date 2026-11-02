import { useState } from 'react'
import { Inbox } from 'lucide-react'
import { useVault } from '@/presentation/app/providers/vaultProvider'

export function RecebidosPage() {
  const vault = useVault()
  const [mensagem, setMensagem] = useState('')
  const [carregando, setCarregando] = useState(false)

  async function processar() {
    setCarregando(true)
    try {
      const n = await vault.processarRecebidos(null)
      setMensagem(`${n} arquivo(s) importado(s) para a raiz.`)
    } catch (e) {
      setMensagem(e instanceof Error ? e.message : String(e))
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="mx-auto max-w-md text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-600/30">
        <Inbox className="h-7 w-7" aria-hidden />
      </span>
      <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-slate-100">Recebidos</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Conteúdo compartilhado de outros aplicativos (Web Share Target) aparece aqui e pode ser importado para o cofre.
      </p>
      <button
        type="button"
        disabled={carregando}
        onClick={() => void processar()}
        className="mt-6 rounded-full bg-brand-600 px-6 py-2 text-sm font-bold text-white shadow-md shadow-brand-600/30"
      >
        Importar para a raiz
      </button>
      {mensagem ? <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">{mensagem}</p> : null}
    </div>
  )
}
