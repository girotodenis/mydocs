import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowLeft } from 'lucide-react'
import { useVault } from '@/presentation/app/providers/vaultProvider'

export function ViewerPage() {
  const { itemId } = useParams<{ itemId: string }>()
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

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-brand-600 dark:text-slate-300">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Voltar
        </Link>
        <span className="truncate text-lg font-bold text-slate-900 dark:text-slate-100">{item.nome}</span>
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
