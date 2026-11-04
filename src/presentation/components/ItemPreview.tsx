import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Loader2, TriangleAlert } from 'lucide-react'
import type { Item } from '@/domain/entities'
import type { TipoPreview } from '@/domain/preview'
import { useVault } from '@/presentation/app/providers/vaultProvider'

export type DadosItem = { bytes: Uint8Array; tipo: TipoPreview }

type Props = {
  item: Item
  onCarregado?: (dados: DadosItem) => void
}

export function ItemPreview({ item, onCarregado }: Props) {
  const vault = useVault()
  const [dados, setDados] = useState<DadosItem | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const callbackRef = useRef(onCarregado)

  useEffect(() => {
    callbackRef.current = onCarregado
  }, [onCarregado])

  useEffect(() => {
    let ativo = true
    let objectUrl: string | null = null
    setDados(null)
    setUrl(null)
    setErro(null)

    void vault
      .abrirItem(item)
      .then((resultado) => {
        if (!ativo) return
        if (resultado.tipo === 'imagem' || resultado.tipo === 'video' || resultado.tipo === 'audio' || resultado.tipo === 'pdf') {
          objectUrl = URL.createObjectURL(new Blob([new Uint8Array(resultado.bytes)], { type: item.mime }))
          setUrl(objectUrl)
        }
        setDados(resultado)
        callbackRef.current?.(resultado)
      })
      .catch((e: unknown) => {
        if (ativo) setErro(e instanceof Error ? e.message : String(e))
      })

    return () => {
      ativo = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id])

  if (erro) {
    return (
      <p className="flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
        <TriangleAlert className="h-4 w-4" aria-hidden />
        {erro}
      </p>
    )
  }

  if (!dados || !item) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-slate-500 dark:text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        Carregando…
      </div>
    )
  }

  const texto = new TextDecoder().decode(dados.bytes)

  if (dados.tipo === 'imagem' && url) {
    return (
      <img
        src={url}
        alt={item.nome}
        className="mx-auto max-h-[65vh] max-w-full rounded-xl border border-slate-200 object-contain dark:border-slate-800"
      />
    )
  }

  if (dados.tipo === 'video' && url) {
    return <video controls src={url} className="mx-auto max-h-[65vh] w-full rounded-xl border border-slate-200 dark:border-slate-800" />
  }

  if (dados.tipo === 'audio' && url) {
    return <audio controls src={url} className="w-full" />
  }

  if (dados.tipo === 'pdf' && url) {
    return (
      <iframe
        title={item.nome}
        src={url}
        className="h-[65vh] w-full rounded-xl border border-slate-200 bg-white dark:border-slate-800"
      />
    )
  }

  if (dados.tipo === 'markdown') {
    return (
      <article className="max-w-none break-words text-slate-800 dark:text-slate-200">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{texto}</ReactMarkdown>
      </article>
    )
  }

  if (dados.tipo === 'html') {
    return (
      <iframe
        title={item.nome}
        srcDoc={texto}
        sandbox=""
        className="h-[65vh] w-full rounded-xl border border-slate-200 bg-white dark:border-slate-800"
      />
    )
  }

  return (
    <pre className="max-h-[65vh] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
      {texto}
    </pre>
  )
}
