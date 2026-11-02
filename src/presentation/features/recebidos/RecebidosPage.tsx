import { useEffect, useRef, useState } from 'react'
import { Inbox } from 'lucide-react'
import { useVault } from '@/presentation/app/providers/vaultProvider'

export function RecebidosPage() {
  const vault = useVault()
  const [mensagem, setMensagem] = useState('')
  const [carregando, setCarregando] = useState(false)
  const importouRef = useRef(false)

  async function processar() {
    setCarregando(true)
    try {
      const n = await vault.processarRecebidos(null)
      setMensagem(n > 0 ? `${n} arquivo(s) importado(s) para a raiz.` : 'Nenhum arquivo recebido pendente.')
    } catch (e) {
      setMensagem(e instanceof Error ? e.message : String(e))
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    if (vault.status === 'pronto' && !importouRef.current) {
      importouRef.current = true
      void processar()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vault.status])

  return (
    <div className="mx-auto max-w-md text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-600/30">
        <Inbox className="h-7 w-7" aria-hidden />
      </span>
      <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-slate-100">Recebidos</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Arquivos, textos e links compartilhados são importados automaticamente para a raiz do cofre.
      </p>
      <button
        type="button"
        disabled={carregando}
        onClick={() => void processar()}
        className="mt-6 rounded-full bg-brand-600 px-6 py-2 text-sm font-bold text-white shadow-md shadow-brand-600/30"
      >
        Importar agora
      </button>
      {mensagem ? <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">{mensagem}</p> : null}
    </div>
  )
}
