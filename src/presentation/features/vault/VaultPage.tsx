import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowUp,
  Download,
  Eye,
  FilePlus,
  FileText,
  Folder,
  FolderPlus,
  FolderInput,
  Image,
  Loader2,
  Lock,
  LogIn,
  Pencil,
  Share2,
  Trash2,
  Upload,
} from 'lucide-react'
import type { Item, PastaId } from '@/domain/entities'
import { itensDaPasta, resolverCaminho, subpastasDe } from '@/domain/arvore'
import { formatarBytes } from '@/domain/tamanho'
import { MAX_FILE_BYTES } from '@/infrastructure/config'
import { useVault } from '@/presentation/app/providers/vaultProvider'
import { useLoading } from '@/presentation/app/providers/loadingProvider'

export function VaultPage() {
  const vault = useVault()
  const loading = useLoading()
  const [senha, setSenha] = useState('')
  const [pastaAtual, setPastaAtualState] = useState<PastaId | null>(null)
  const [carregando, setCarregando] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function definirPasta(p: PastaId | null) {
    const key = `mydocs:pasta:${vault.vaultId}`
    if (p) localStorage.setItem(key, p)
    else localStorage.removeItem(key)
    setPastaAtualState(p)
  }

  useEffect(() => {
    const key = `mydocs:pasta:${vault.vaultId}`
    const saved = localStorage.getItem(key)
    if (saved && vault.manifesto?.pastas.some((p) => p.id === saved)) {
      setPastaAtualState(saved)
    } else {
      setPastaAtualState(null)
    }
  }, [vault.vaultId, vault.manifesto])

  const pastas = useMemo(() => (vault.manifesto ? subpastasDe(vault.manifesto, pastaAtual) : []), [vault.manifesto, pastaAtual])
  const itens = useMemo(() => (vault.manifesto ? itensDaPasta(vault.manifesto, pastaAtual) : []), [vault.manifesto, pastaAtual])
  const caminho = useMemo(() => (vault.manifesto ? resolverCaminho(vault.manifesto, pastaAtual) : []), [vault.manifesto, pastaAtual])

  async function entrarNoCofre(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!senha || carregando) return
    await comCarregando('Abrindo cofre…', () => vault.entrarNoCofre(senha))
  }

  async function comCarregando(mensagem: string, fn: () => Promise<void>) {
    setCarregando(true)
    try {
      await loading.comCarregando(mensagem, fn)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e))
    } finally {
      setCarregando(false)
    }
  }

  function criarPasta() {
    const nome = window.prompt('Nome da nova pasta')
    if (!nome) return
    void comCarregando('Criando pasta…', () => vault.criarPasta(nome, pastaAtual))
  }

  function renomearPasta(id: string, nomeAtual: string) {
    const nome = window.prompt('Renomear pasta', nomeAtual)
    if (!nome) return
    void comCarregando('Renomeando pasta…', () => vault.renomearPasta(id, nome))
  }

  function excluirPasta(id: string) {
    if (!window.confirm('Excluir esta pasta e todo o seu conteúdo?')) return
    void comCarregando('Excluindo pasta…', () => vault.excluirPasta(id))
  }

  async function enviarArquivos(files: FileList | null) {
    if (!files || files.length === 0) return
    const lista = Array.from(files)
    const limiteMB = Math.round(MAX_FILE_BYTES / (1024 * 1024))
    for (const file of lista) {
      if (file.size > MAX_FILE_BYTES) {
        window.alert(`"${file.name}" excede o limite de ${limiteMB} MB`)
        continue
      }
      const bytes = new Uint8Array(await file.arrayBuffer())
      await comCarregando(`Enviando ${file.name}…`, () =>
        vault.enviar({ nome: file.name, mime: file.type, bytes, pastaId: pastaAtual }),
      )
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  function renomearItem(id: string, nomeAtual: string) {
    const nome = window.prompt('Renomear arquivo', nomeAtual)
    if (!nome) return
    void comCarregando('Renomeando arquivo…', () => vault.renomearItem(id, nome))
  }

  function moverItem(id: string) {
    const destino = window.prompt('Mover para (nome da pasta; deixe vazio para a raiz)')
    if (destino === null) return
    const alvo = destino.trim()
      ? (vault.manifesto?.pastas.find((p) => p.nome.toLowerCase() === destino.trim().toLowerCase())?.id ?? null)
      : null
    if (alvo === null && destino.trim()) {
      window.alert('Pasta não encontrada')
      return
    }
    void comCarregando('Movendo arquivo…', () => vault.moverItem(id, alvo))
  }

  function excluirItem(id: string) {
    if (!window.confirm('Excluir este arquivo?')) return
    void comCarregando('Excluindo arquivo…', () => vault.excluirItem(id))
  }

  function compartilhar(item: Item) {
    void comCarregando(`Compartilhando ${item.nome}…`, () => vault.compartilhar(item))
  }

  async function baixar(item: Item) {
    await loading.comCarregando(`Baixando ${item.nome}…`, async () => {
      const { bytes } = await vault.abrirItem(item)
      const blob = new Blob([new Uint8Array(bytes)], { type: item.mime })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = item.nome
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  if (!vault.configurado) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Configuração necessária</h1>
        <p className="mt-3 text-slate-600 dark:text-slate-400">
          Copie <code>.env.example</code> para <code>.env</code> e preencha <code>VITE_GOOGLE_CLIENT_ID</code>.
        </p>
      </div>
    )
  }

  if (!vault.autenticado) {
    return (
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Bem-vindo ao MyDocs</h1>
        <p className="mt-3 text-slate-600 dark:text-slate-400">Entre com sua conta Google para acessar o cofre.</p>
        <button
          type="button"
          disabled={carregando}
          onClick={() => void comCarregando('Conectando ao Google…', vault.login)}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-500 to-brand-700 px-6 py-2 text-sm font-bold text-white shadow-md shadow-brand-600/40 disabled:opacity-60"
        >
          {carregando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <LogIn className="h-4 w-4" aria-hidden />}
          {carregando ? 'Conectando…' : 'Entrar com Google'}
        </button>
      </div>
    )
  }

  if (vault.status === 'sem-cofre' || vault.status === 'bloqueado') {
    return (
      <div className="mx-auto max-w-md">
        <h1 className="text-center text-2xl font-bold text-slate-900 dark:text-slate-100">
          <Lock className="mr-2 inline h-5 w-5" aria-hidden />
          Cofre
        </h1>
        <p className="mt-1 text-center text-xs text-slate-500 dark:text-slate-400">
          Digite sua senha para entrar. Se o cofre ainda não existir, ele será criado agora.
        </p>
        <form onSubmit={(event) => void entrarNoCofre(event)} className="mt-4">
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Senha"
            autoComplete="current-password"
            enterKeyHint="go"
            aria-label="Senha do cofre"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          <button
            type="submit"
            disabled={carregando}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {carregando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {carregando ? 'Abrindo…' : 'Entrar'}
          </button>
        </form>
        {vault.erro ? (
          <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{vault.erro}</p>
        ) : null}
        {vault.cofreExiste ? (
          <button
            type="button"
            disabled={carregando}
            onClick={() => {
              if (window.confirm('Apagar o cofre e todos os arquivos? Essa ação não pode ser desfeita.')) {
                void comCarregando('Apagando cofre…', () => vault.apagarCofre())
              }
            }}
            className="mt-3 w-full rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
          >
            Apagar cofre
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        void enviarArquivos(e.dataTransfer.files)
      }}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <button type="button" onClick={() => definirPasta(null)} className="font-medium hover:text-brand-600">
            Raiz
          </button>
          {caminho.map((p) => (
            <span key={p.id} className="flex items-center gap-2">
              <span className="text-slate-400">/</span>
              <button type="button" onClick={() => definirPasta(p.id)} className="font-medium hover:text-brand-600">
                {p.nome}
              </button>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {pastaAtual ? (
            <button
              type="button"
              onClick={() => definirPasta(caminho[caminho.length - 2]?.id ?? null)}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <ArrowUp className="h-3.5 w-3.5" aria-hidden />
              Subir
            </button>
          ) : null}
          <button
            type="button"
            onClick={criarPasta}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <FolderPlus className="h-3.5 w-3.5" aria-hidden />
            Nova pasta
          </button>
          <Link
            to={pastaAtual ? `/editor?pasta=${pastaAtual}` : '/editor'}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <FilePlus className="h-3.5 w-3.5" aria-hidden />
            Nova nota
          </Link>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-1.5 text-xs font-bold text-white shadow-md shadow-brand-600/30"
          >
            <Upload className="h-3.5 w-3.5" aria-hidden />
            Enviar arquivos
          </button>
          <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => void enviarArquivos(e.target.files)} />
        </div>
      </div>

      {pastas.length === 0 && itens.length === 0 ? (
        <p className="py-16 text-center text-slate-500 dark:text-slate-400">Pasta vazia. Envie arquivos ou crie uma subpasta.</p>
      ) : (
        <div className="grid gap-2">
          {pastas.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
            >
              <Folder className="h-5 w-5 text-brand-500" aria-hidden />
              <button type="button" onClick={() => definirPasta(p.id)} className="flex-1 text-left font-medium text-slate-900 hover:text-brand-600 dark:text-slate-100">
                {p.nome}
              </button>
              <button type="button" onClick={() => renomearPasta(p.id, p.nome)} className="p-1.5 text-slate-400 hover:text-brand-600" aria-label="Renomear">
                <Pencil className="h-4 w-4" aria-hidden />
              </button>
              <button type="button" onClick={() => excluirPasta(p.id)} className="p-1.5 text-slate-400 hover:text-red-600" aria-label="Excluir">
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ))}
          {itens.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
            >
              {item.mime.startsWith('image/') ? <Image className="h-5 w-5 text-emerald-500" aria-hidden /> : <FileText className="h-5 w-5 text-brand-500" aria-hidden />}
              <Link to={`/item/${item.id}`} className="flex-1 truncate font-medium text-slate-900 hover:text-brand-600 dark:text-slate-100">
                {item.nome}
              </Link>
              <span className="hidden text-xs text-slate-400 sm:inline">{formatarBytes(item.tamanho)}</span>
              <Link to={`/item/${item.id}`} className="p-1.5 text-slate-400 hover:text-brand-600" aria-label="Visualizar">
                <Eye className="h-4 w-4" aria-hidden />
              </Link>
              {(item.mime.startsWith('text/') || item.mime === 'application/json' || item.mime === 'application/xml') ? (
                <Link to={`/editor/${item.id}`} className="p-1.5 text-slate-400 hover:text-brand-600" aria-label="Editar">
                  <Pencil className="h-4 w-4" aria-hidden />
                </Link>
              ) : null}
              <button type="button" onClick={() => void baixar(item)} className="p-1.5 text-slate-400 hover:text-brand-600" aria-label="Baixar">
                <Download className="h-4 w-4" aria-hidden />
              </button>
              <button type="button" onClick={() => compartilhar(item)} className="p-1.5 text-slate-400 hover:text-brand-600" aria-label="Compartilhar">
                <Share2 className="h-4 w-4" aria-hidden />
              </button>
              <button type="button" onClick={() => moverItem(item.id)} className="p-1.5 text-slate-400 hover:text-brand-600" aria-label="Mover">
                <FolderInput className="h-4 w-4" aria-hidden />
              </button>
              <button type="button" onClick={() => renomearItem(item.id, item.nome)} className="p-1.5 text-slate-400 hover:text-brand-600" aria-label="Renomear">
                <Pencil className="h-4 w-4" aria-hidden />
              </button>
              <button type="button" onClick={() => excluirItem(item.id)} className="p-1.5 text-slate-400 hover:text-red-600" aria-label="Excluir">
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
