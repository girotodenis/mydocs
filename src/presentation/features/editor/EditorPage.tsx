import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import CodeMirror from '@uiw/react-codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { html } from '@codemirror/lang-html'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowLeft, Eye, Loader2, Pencil, Save } from 'lucide-react'
import { useVault } from '@/presentation/app/providers/vaultProvider'
import { useTheme } from '@/presentation/app/providers/themeContext'
import { cn } from '@/presentation/cn'

export function EditorPage() {
  const { itemId } = useParams<{ itemId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const pastaDestino = searchParams.get('pasta')
  const vault = useVault()
  const { theme } = useTheme()
  const item = useMemo(() => (itemId ? vault.manifesto?.itens.find((i) => i.id === itemId) : undefined), [itemId, vault.manifesto])

  const [titulo, setTitulo] = useState('')
  const [tipo, setTipo] = useState<'markdown' | 'html' | 'text'>('markdown')
  const [conteudo, setConteudo] = useState('')
  const [preview, setPreview] = useState(false)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (item) {
      setTitulo(item.nome.replace(/\.(md|html|htm|txt)$/i, ''))
      setTipo(item.mime === 'text/html' ? 'html' : item.mime === 'text/markdown' ? 'markdown' : 'text')
      void vault.abrirItem(item).then((r) => setConteudo(new TextDecoder().decode(r.bytes)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id])

  async function salvar() {
    setSalvando(true)
    try {
      const ext = tipo === 'html' ? 'html' : tipo === 'text' ? 'txt' : 'md'
      const nome = `${titulo.trim() || 'sem-titulo'}.${ext}`
      const mime = tipo === 'html' ? 'text/html' : tipo === 'text' ? 'text/plain' : 'text/markdown'
      const bytes = new TextEncoder().encode(conteudo)
      if (item) await vault.atualizarItem(item.id, nome, mime, bytes)
      else await vault.salvarNota(titulo, conteudo, tipo, pastaDestino)
      navigate('/')
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e))
    } finally {
      setSalvando(false)
    }
  }

  const extensions = tipo === 'html' ? [html()] : tipo === 'markdown' ? [markdown({ base: markdownLanguage })] : []

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-brand-600 dark:text-slate-300">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Voltar
        </button>
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Título da nota"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
        <div className="flex rounded-lg border border-slate-300 p-0.5 dark:border-slate-700">
          {(
            [
              ['markdown', 'Markdown'],
              ['html', 'HTML'],
              ['text', 'Texto'],
            ] as const
          ).map(([t, label]) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-semibold',
                tipo === t ? 'bg-brand-600 text-white' : 'text-slate-500 hover:text-brand-600 dark:text-slate-400',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setPreview((p) => !p)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"
        >
          {preview ? <Pencil className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
          {preview ? 'Editar' : 'Visualizar'}
        </button>
        <button
          type="button"
          disabled={salvando}
          onClick={() => void salvar()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
      </div>

      {preview ? (
        tipo === 'html' ? (
          <iframe title="Preview" srcDoc={conteudo} sandbox="" className="h-[70vh] w-full rounded-xl border border-slate-200 bg-white dark:border-slate-800" />
        ) : tipo === 'markdown' ? (
          <article className="max-w-none rounded-xl border border-slate-200 bg-white p-4 text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{conteudo}</ReactMarkdown>
          </article>
        ) : (
          <pre className="h-[70vh] overflow-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
            {conteudo}
          </pre>
        )
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
          <CodeMirror
            value={conteudo}
            onChange={setConteudo}
            extensions={extensions}
            height="70vh"
            theme={theme}
            className="text-sm"
          />
        </div>
      )}
    </div>
  )
}
