import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowUp,
  CloudOff,
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
  Pencil,
  Share2,
  Trash2,
  Upload,
} from 'lucide-react'
import type { Item, PastaId } from '@/domain/entities'
import { itensDaPasta, resolverCaminho, subpastasDe } from '@/domain/arvore'
import { formatarBytes } from '@/domain/tamanho'
import { MAX_FILE_BYTES } from '@/infrastructure/config'
import { cn } from '@/presentation/cn'
import { useVault } from '@/presentation/app/providers/vaultProvider'
import { useLoading } from '@/presentation/app/providers/loadingProvider'
import { ItemPreviewModal } from '@/presentation/components/ItemPreviewModal'

const acaoIcone =
  'inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800'

function ehEditavel(item: Item) {
  return item.mime.startsWith('text/') || item.mime === 'application/json' || item.mime === 'application/xml'
}

export function VaultPage() {
  const vault = useVault()
  const loading = useLoading()
  const [senha, setSenha] = useState('')
  const [pastaAtual, setPastaAtualState] = useState<PastaId | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [itemAberto, setItemAberto] = useState<Item | null>(null)
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
  const itemSelecionado = useMemo(
    () => (itemAberto ? (vault.manifesto?.itens.find((i) => i.id === itemAberto.id) ?? null) : null),
    [itemAberto, vault.manifesto],
  )

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

  if (vault.status === 'sem-cofre' || vault.status === 'bloqueado') {
    return (
      <div className="mx-auto max-w-md">
        <h1 className="text-center text-2xl font-bold text-slate-900 dark:text-slate-100">
          <Lock className="mr-2 inline h-5 w-5" aria-hidden />
          {vault.cofreExiste ? 'Cofre bloqueado' : 'Criar seu cofre'}
        </h1>
        <p className="mt-1 text-center text-xs text-slate-500 dark:text-slate-400">
          {vault.cofreExiste
            ? 'Digite a senha do cofre para entrar. Ela fica só neste dispositivo — não é sua conta Google.'
            : 'Escolha uma senha para proteger seus arquivos. Nenhuma conta Google é necessária; a sincronização com o Drive é opcional.'}
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
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
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
      {!vault.vinculado ? (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <CloudOff className="h-4 w-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">
            Este cofre está só neste dispositivo. Toque em <strong>“Não sincronizado”</strong> para enviá-lo ao Google
            Drive.
          </span>
        </div>
      ) : null}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 text-sm text-slate-600 sm:pb-0 dark:text-slate-300">
          <button
            type="button"
            onClick={() => definirPasta(null)}
            className="shrink-0 whitespace-nowrap font-medium hover:text-brand-600"
          >
            Raiz
          </button>
          {caminho.map((p) => (
            <span key={p.id} className="flex shrink-0 items-center gap-2">
              <span className="text-slate-400">/</span>
              <button
                type="button"
                onClick={() => definirPasta(p.id)}
                className="whitespace-nowrap font-medium hover:text-brand-600"
              >
                {p.nome}
              </button>
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-brand-600/30 sm:w-auto"
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
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:gap-3"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 dark:bg-slate-800">
                <Folder className="h-4 w-4 text-brand-500" aria-hidden />
              </span>
              <button
                type="button"
                onClick={() => definirPasta(p.id)}
                className="min-w-0 flex-1 truncate text-left font-medium text-slate-900 hover:text-brand-600 dark:text-slate-100"
                title={p.nome}
              >
                {p.nome}
              </button>
              <button
                type="button"
                onClick={() => renomearPasta(p.id, p.nome)}
                className={cn(acaoIcone, 'hover:text-brand-600')}
                aria-label={`Renomear ${p.nome}`}
                title="Renomear"
              >
                <Pencil className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => excluirPasta(p.id)}
                className={cn(acaoIcone, 'hover:text-red-600')}
                aria-label={`Excluir ${p.nome}`}
                title="Excluir"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ))}

          {itens.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-slate-200 bg-white p-3 transition-colors hover:border-brand-200 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-500/40"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 dark:bg-slate-800">
                  {item.mime.startsWith('image/') ? (
                    <Image className="h-4 w-4 text-emerald-500" aria-hidden />
                  ) : (
                    <FileText className="h-4 w-4 text-brand-500" aria-hidden />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => setItemAberto(item)}
                    className="block w-full truncate text-left font-medium text-slate-900 hover:text-brand-600 dark:text-slate-100"
                    title={item.nome}
                  >
                    {item.nome}
                  </button>
                  <p className="truncate text-xs text-slate-400">{formatarBytes(item.tamanho)}</p>
                </div>

                <div className="flex w-full flex-wrap items-center justify-end gap-0.5 border-t border-slate-100 pt-2 sm:w-auto sm:flex-nowrap sm:border-0 sm:pt-0 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setItemAberto(item)}
                    className={cn(acaoIcone, 'hover:text-brand-600')}
                    aria-label={`Visualizar ${item.nome}`}
                    title="Visualizar"
                  >
                    <Eye className="h-4 w-4" aria-hidden />
                  </button>
                  {ehEditavel(item) ? (
                    <Link
                      to={`/editor/${item.id}`}
                      className={cn(acaoIcone, 'hover:text-brand-600')}
                      aria-label={`Editar ${item.nome}`}
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void baixar(item)}
                    className={cn(acaoIcone, 'hover:text-brand-600')}
                    aria-label={`Baixar ${item.nome}`}
                    title="Baixar"
                  >
                    <Download className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => compartilhar(item)}
                    className={cn(acaoIcone, 'hover:text-brand-600')}
                    aria-label={`Compartilhar ${item.nome}`}
                    title="Compartilhar"
                  >
                    <Share2 className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => moverItem(item.id)}
                    className={cn(acaoIcone, 'hover:text-brand-600')}
                    aria-label={`Mover ${item.nome}`}
                    title="Mover"
                  >
                    <FolderInput className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => renomearItem(item.id, item.nome)}
                    className={cn(acaoIcone, 'hover:text-brand-600')}
                    aria-label={`Renomear ${item.nome}`}
                    title="Renomear"
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => excluirItem(item.id)}
                    className={cn(acaoIcone, 'hover:text-red-600')}
                    aria-label={`Excluir ${item.nome}`}
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ItemPreviewModal item={itemSelecionado} onFechar={() => setItemAberto(null)} />
    </div>
  )
}
