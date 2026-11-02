import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowLeft, Download, Pencil, Share2, Trash2 } from 'lucide-react'
import { useVault } from '@/presentation/app/providers/vaultProvider'

export function ViewerPage() {
  const { itemId } = useParams<{ itemId: string }>()
  const navigate = useNavigate()
  const vault = useVault()
  const item = useMemo(() => vault.manifesto?.itens.find((i) => i.id === itemId), [vault.manifesto, itemId])
  const [bytes, setBytes] = useState<Uint8Array | null>(null)
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    if (item) {
      void vault.abrirItem(item).then((r) => {
        if (!active) return
        setBytes(r.bytes)
        if (r.tipo === 'imagem') {
          const blob = new Blob([new Uint8Array(r.bytes)], { type: item.mime })
          setUrl(URL.createObjectURL(blob))
        }
      })
    }
    return () => {
      active = false
      if (url) URL.revokeObjectURL(url)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id])

  if (!item) {
    return <p className="text-center text-slate-500">Arquivo não encontrado.</p>
  }

  const texto = bytes ? new TextDecoder().decode(bytes) : ''
  const tipo = item.mime.startsWith('image/') ? 'imagem' : item.mime === 'text/markdown' ? 'markdown' : item.mime === 'text/html' ? 'html' : 'texto'
  const editavel = item.mime.startsWith('text/') || item.mime === 'application/json' || item.mime === 'application/xml'

  function baixar() {
    if (!bytes) return
    const blob = new Blob([new Uint8Array(bytes)], { type: item.mime })
    const u = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = u
    a.download = item.nome
    a.click()
    URL.revokeObjectURL(u)
  }

  function compartilhar() {
    void vault.compartilhar(item)
  }

  async function excluir() {
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
        <span className="truncate text-lg font-bold text-slate-900 dark:text-slate-100">{item.nome}</span>
        <div className="ml-auto flex items-center gap-1">
          {editavel ? (
            <Link to={`/editor/${item.id}`} className="p-1.5 text-slate-400 hover:text-brand-600" aria-label="Editar">
              <Pencil className="h-4 w-4" aria-hidden />
            </Link>
          ) : null}
          <button type="button" onClick={baixar} className="p-1.5 text-slate-400 hover:text-brand-600" aria-label="Baixar">
            <Download className="h-4 w-4" aria-hidden />
          </button>
          <button type="button" onClick={compartilhar} className="p-1.5 text-slate-400 hover:text-brand-600" aria-label="Compartilhar">
            <Share2 className="h-4 w-4" aria-hidden />
          </button>
          <button type="button" onClick={() => void excluir()} className="p-1.5 text-slate-400 hover:text-red-600" aria-label="Excluir">
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      {bytes === null ? (
        <p className="text-slate-500">Carregando…</p>
      ) : tipo === 'imagem' && url ? (
        <img src={url} alt={item.nome} className="mx-auto max-h-[70vh] rounded-xl border border-slate-200 dark:border-slate-800" />
      ) : tipo === 'markdown' ? (
        <article className="max-w-none text-slate-800 dark:text-slate-200">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{texto}</ReactMarkdown>
        </article>
      ) : tipo === 'html' ? (
        <iframe title={item.nome} srcDoc={texto} sandbox="" className="h-[70vh] w-full rounded-xl border border-slate-200 bg-white dark:border-slate-800" />
      ) : (
        <pre className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
          {texto}
        </pre>
      )}
    </div>
  )
}
