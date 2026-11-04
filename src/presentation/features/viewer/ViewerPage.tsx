import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Pencil, Share2, Trash2 } from 'lucide-react'
import { useVault } from '@/presentation/app/providers/vaultProvider'
import { useLoading } from '@/presentation/app/providers/loadingProvider'
import { ItemPreview, type DadosItem } from '@/presentation/components/ItemPreview'

export function ViewerPage() {
  const { itemId } = useParams<{ itemId: string }>()
  const navigate = useNavigate()
  const vault = useVault()
  const loading = useLoading()
  const item = useMemo(() => vault.manifesto?.itens.find((i) => i.id === itemId), [vault.manifesto, itemId])
  const [dados, setDados] = useState<DadosItem | null>(null)

  if (!item) {
    return <p className="text-center text-slate-500">Arquivo não encontrado.</p>
  }

  const editavel =
    item.mime.startsWith('text/') || item.mime === 'application/json' || item.mime === 'application/xml'

  const baixar = () => {
    void loading.comCarregando(`Baixando ${item.nome}…`, async () => {
      const bytes = dados?.bytes ?? (await vault.abrirItem(item)).bytes
      const blob = new Blob([new Uint8Array(bytes)], { type: item.mime })
      const u = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = u
      a.download = item.nome
      a.click()
      URL.revokeObjectURL(u)
    })
  }

  const compartilhar = () => {
    void loading.comCarregando(`Compartilhando ${item.nome}…`, () => vault.compartilhar(item))
  }

  const excluir = async () => {
    if (!window.confirm('Excluir este arquivo?')) return
    await vault.excluirItem(item.id)
    navigate('/')
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-brand-600 dark:text-slate-300">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Voltar
        </Link>
        <span className="min-w-0 flex-1 truncate text-base font-bold text-slate-900 sm:text-lg dark:text-slate-100">
          {item.nome}
        </span>
        <div className="flex items-center gap-1">
          {editavel ? (
            <Link
              to={`/editor/${item.id}`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800"
              aria-label="Editar"
            >
              <Pencil className="h-4 w-4" aria-hidden />
            </Link>
          ) : null}
          <button
            type="button"
            onClick={baixar}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800"
            aria-label="Baixar"
          >
            <Download className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={compartilhar}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800"
            aria-label="Compartilhar"
          >
            <Share2 className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => void excluir()}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-red-600 dark:hover:bg-slate-800"
            aria-label="Excluir"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      <ItemPreview item={item} onCarregado={setDados} />
    </div>
  )
}
