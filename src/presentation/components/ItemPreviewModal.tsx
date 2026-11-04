import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Pencil, Share2, Trash2 } from 'lucide-react'
import type { Item } from '@/domain/entities'
import { cn } from '@/presentation/cn'
import { useVault } from '@/presentation/app/providers/vaultProvider'
import { useLoading } from '@/presentation/app/providers/loadingProvider'
import { Modal } from './Modal'
import { ItemPreview, type DadosItem } from './ItemPreview'

const acaoClass =
  'inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-brand-600 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'

type Props = {
  item: Item | null
  onFechar: () => void
}

function ehEditavel(item: Item) {
  return item.mime.startsWith('text/') || item.mime === 'application/json' || item.mime === 'application/xml'
}

export function ItemPreviewModal({ item, onFechar }: Props) {
  const vault = useVault()
  const loading = useLoading()
  const [dados, setDados] = useState<DadosItem | null>(null)

  useEffect(() => {
    setDados(null)
  }, [item?.id])

  function avisar(e: unknown) {
    window.alert(e instanceof Error ? e.message : String(e))
  }

  async function baixar() {
    if (!item) return
    try {
      await loading.comCarregando(`Baixando ${item.nome}…`, async () => {
        const bytes = dados?.bytes ?? (await vault.abrirItem(item)).bytes
        const blob = new Blob([new Uint8Array(bytes)], { type: item.mime })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = item.nome
        a.click()
        URL.revokeObjectURL(url)
      })
    } catch (e) {
      avisar(e)
    }
  }

  async function compartilhar() {
    if (!item) return
    try {
      await loading.comCarregando(`Compartilhando ${item.nome}…`, () => vault.compartilhar(item))
    } catch (e) {
      avisar(e)
    }
  }

  async function excluir() {
    if (!item) return
    if (!window.confirm('Excluir este arquivo?')) return
    try {
      await loading.comCarregando('Excluindo arquivo…', () => vault.excluirItem(item.id))
      onFechar()
    } catch (e) {
      avisar(e)
    }
  }

  return (
    <Modal
      aberto={item !== null}
      titulo={item?.nome ?? 'Visualizar'}
      onFechar={onFechar}
      largura="xl"
      acoes={
        item ? (
          <div className="flex flex-wrap items-center gap-2">
            {ehEditavel(item) ? (
              <Link to={`/editor/${item.id}`} className={acaoClass}>
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                Editar
              </Link>
            ) : null}
            <button type="button" onClick={() => void baixar()} className={acaoClass}>
              <Download className="h-3.5 w-3.5" aria-hidden />
              Baixar
            </button>
            <button type="button" onClick={() => void compartilhar()} className={acaoClass}>
              <Share2 className="h-3.5 w-3.5" aria-hidden />
              Compartilhar
            </button>
            <button
              type="button"
              onClick={() => void excluir()}
              className={cn(acaoClass, 'hover:text-red-600 dark:hover:text-red-400')}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Excluir
            </button>
          </div>
        ) : null
      }
    >
      {item ? <ItemPreview item={item} onCarregado={setDados} /> : null}
    </Modal>
  )
}
