import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Item, Manifesto, PastaId } from '@/domain/entities'
import type { TipoNota } from '@/domain/editor'
import type { TipoPreview } from '@/domain/preview'
import type { ContextoVault } from '@/application/contexto'
import {
  adotarCofreDoDrive,
  conectarCofreAoServidor,
  ConflitoDeSenhaError,
} from '@/application/conexao'
import * as aplicacaoCripto from '@/application/criptografia'
import * as aplicacaoEditor from '@/application/editor'
import * as aplicacaoItens from '@/application/itens'
import * as aplicacaoPastas from '@/application/pastas'
import * as aplicacaoPreview from '@/application/preview'
import * as aplicacaoRecebidos from '@/application/recebidos'
import * as aplicacaoShare from '@/application/share'
import * as aplicacaoSync from '@/application/sync'
import * as aplicacaoVault from '@/application/vault'
import {
  carregarSessoes,
  guardarSessao,
  obterSessao,
  persistirSessao,
  removerSessao,
} from '@/infrastructure/cripto/chaveSessao'
import { removerVerificador } from '@/infrastructure/cripto/verificadorLocal'
import { excluirArquivo, TokenExpiradoError } from '@/infrastructure/drive/api'
import { arquivarPastaApp } from '@/infrastructure/drive/pasta'
import { criarSharePort } from '@/infrastructure/share/navegadorShare'
import { criarShareTargetPort } from '@/infrastructure/share/inboxShareTarget'
import { decorarItemStore } from '@/infrastructure/storage/offlineRepositories'
import { iniciarCache, lerManifestoCache, limparCofreCache } from '@/infrastructure/storage/cache'
import { contarPendencias, iniciarOutbox, limparFila } from '@/infrastructure/storage/outbox'
import { criarDriveItemStore, criarItemStoreLocal } from '@/infrastructure/vault/itemStore'
import { criarDriveVaultRepository } from '@/infrastructure/vault/vaultRepository'
import { useOnlineStatus } from '@/presentation/hooks/useOnlineStatus'
import { tokenExpirado, useAuth } from './authProvider'

const FOLDER_NAME = (import.meta.env.VITE_VAULT_FOLDER_NAME as string | undefined) ?? 'mydocs_vault'
const WORKSPACE_KEY = 'mydocs:workspace'

export type StatusVault = 'sem-cofre' | 'bloqueado' | 'pronto'

export interface ArquivoUpload {
  nome: string
  mime: string
  bytes: Uint8Array
  pastaId: PastaId | null
}

/** Cofre existente no Drive que não abre com a senha do cofre local. */
export interface ConflitoSync {
  folderId: string
}

export interface ResultadoSincronizacao {
  enviados: number
  recebidos: number
}

interface Workspace {
  vaultId: string
  folderId: string
  arquivoId: string
}

interface VaultContextValue {
  status: StatusVault
  vaultId: string
  folderId: string
  arquivoId: string
  manifesto: Manifesto | null
  email: string | null
  autenticado: boolean
  configurado: boolean
  vinculado: boolean
  sincronizado: boolean
  sincronizando: boolean
  conflito: ConflitoSync | null
  erro: string | null
  pendentes: number
  cofreExiste: boolean
  sessaoExpirada: boolean
  login(): Promise<void>
  logout(): void
  sincronizarDrive(): Promise<ResultadoSincronizacao>
  usarCofreDoDrive(senha: string): Promise<void>
  criarNovoCofreNoDrive(): Promise<ResultadoSincronizacao>
  limparConflito(): void
  entrarNoCofre(senha: string): Promise<void>
  apagarCofre(): Promise<void>
  desbloquear(senha: string): Promise<boolean>
  bloquear(): void
  criarPasta(nome: string, parentId: PastaId | null): Promise<void>
  renomearPasta(id: string, nome: string): Promise<void>
  excluirPasta(id: string): Promise<void>
  enviar(arquivo: ArquivoUpload): Promise<void>
  atualizarItem(id: string, nome: string, mime: string, bytes: Uint8Array): Promise<void>
  renomearItem(id: string, nome: string): Promise<void>
  moverItem(id: string, pastaId: PastaId | null): Promise<void>
  excluirItem(id: string): Promise<void>
  abrirItem(item: Item): Promise<{ tipo: TipoPreview; bytes: Uint8Array }>
  compartilhar(item: Item): Promise<void>
  salvarNota(titulo: string, conteudo: string, tipo: TipoNota, pastaId: PastaId | null): Promise<void>
  processarRecebidos(pastaId: PastaId | null, onLog?: (msg: string) => void): Promise<number>
  sincronizar(): Promise<number>
}

const VaultContext = createContext<VaultContextValue | null>(null)

function mensagem(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

function lerWorkspace(): Workspace | null {
  const raw = localStorage.getItem(WORKSPACE_KEY)
  if (!raw) return null
  try {
    const ws = JSON.parse(raw) as Partial<Workspace>
    if (!ws.vaultId) return null
    // Workspaces antigos não tinham `arquivoId`: neles o próprio vaultId era o
    // id do manifesto no Drive.
    return { vaultId: ws.vaultId, folderId: ws.folderId ?? '', arquivoId: ws.arquivoId ?? ws.vaultId }
  } catch {
    return null
  }
}

export function VaultProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const online = useOnlineStatus()
  const onlineRef = useRef(online)
  onlineRef.current = online

  const [status, setStatus] = useState<StatusVault>('sem-cofre')
  const [manifesto, setManifesto] = useState<Manifesto | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pendentes, setPendentes] = useState(0)
  const [cofreExiste, setCofreExiste] = useState(false)
  const [sessaoExpirada, setSessaoExpirada] = useState(false)
  const [vinculado, setVinculado] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const [conflito, setConflito] = useState<ConflitoSync | null>(null)
  const [workspace, setWorkspace] = useState<Workspace>({ vaultId: '', folderId: '', arquivoId: '' })

  const vaultIdRef = useRef('')
  const folderIdRef = useRef('')
  const arquivoIdRef = useRef('')
  const statusRef = useRef<StatusVault>('sem-cofre')
  statusRef.current = status
  const etagRef = useRef<string | undefined>(undefined)
  const manifestoRef = useRef<Manifesto | null>(null)
  const conflitoRef = useRef<ConflitoSync | null>(null)
  conflitoRef.current = conflito
  const importacaoRecebidosRef = useRef<Promise<number> | null>(null)
  const inicializadoRef = useRef(false)

  const sharePort = useMemo(() => criarSharePort(), [])
  const shareTargetPort = useMemo(() => criarShareTargetPort(), [])

  const ctx = useMemo<ContextoVault>(
    () => ({
      get vaultId() {
        return vaultIdRef.current
      },
      get arquivoId() {
        return arquivoIdRef.current
      },
      get folderId() {
        return folderIdRef.current
      },
      vinculado: () => Boolean(arquivoIdRef.current),
      tokenProvider: () => auth.garantirToken(),
      online: () => onlineRef.current,
      get itemStore() {
        // Sem vínculo com o Drive o item vive só no cache local (IndexedDB).
        if (!arquivoIdRef.current) {
          return criarItemStoreLocal({
            vaultId: vaultIdRef.current,
            obterManifesto: () => manifestoRef.current,
          })
        }
        return decorarItemStore(
          criarDriveItemStore({
            tokenProvider: () => auth.garantirToken(),
            folderId: folderIdRef.current,
          }),
          () => onlineRef.current,
        )
      },
      get vaultRepository() {
        return criarDriveVaultRepository({
          tokenProvider: () => auth.garantirToken(),
          vaultId: vaultIdRef.current,
          vaultFileId: arquivoIdRef.current,
          obterSessao: () => obterSessao(vaultIdRef.current),
          obterEtag: () => etagRef.current,
          definirEtag: (etag?: string) => {
            etagRef.current = etag
          },
        })
      },
      sharePort,
      shareTargetPort,
      obterSessao: () => obterSessao(vaultIdRef.current),
      definirSessao: (sessao) => {
        guardarSessao(vaultIdRef.current, sessao)
        void persistirSessao(vaultIdRef.current, sessao)
      },
      limparSessao: () => {
        void removerSessao(vaultIdRef.current)
      },
      obterEtag: () => etagRef.current,
      definirEtag: (etag?: string) => {
        etagRef.current = etag
      },
      lerManifesto: () => manifestoRef.current,
      definirManifesto: (m) => {
        manifestoRef.current = m
        setManifesto(m)
      },
    }),
    [auth, sharePort, shareTargetPort],
  )

  const salvarWorkspace = useCallback(() => {
    const ws: Workspace = {
      vaultId: vaultIdRef.current,
      folderId: folderIdRef.current,
      arquivoId: arquivoIdRef.current,
    }
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(ws))
  }, [])

  const aplicarWorkspace = useCallback((ws: Workspace) => {
    if (ws.arquivoId !== arquivoIdRef.current) etagRef.current = undefined
    vaultIdRef.current = ws.vaultId
    folderIdRef.current = ws.folderId
    arquivoIdRef.current = ws.arquivoId
    setWorkspace(ws)
    setVinculado(Boolean(ws.arquivoId))
    setCofreExiste(true)
    salvarWorkspace()
  }, [salvarWorkspace])

  const limparEstado = useCallback(() => {
    vaultIdRef.current = ''
    folderIdRef.current = ''
    arquivoIdRef.current = ''
    etagRef.current = undefined
    manifestoRef.current = null
    setManifesto(null)
    setVinculado(false)
    setConflito(null)
    setSessaoExpirada(false)
    setCofreExiste(false)
    setWorkspace({ vaultId: '', folderId: '', arquivoId: '' })
    setPendentes(0)
    localStorage.removeItem(WORKSPACE_KEY)
    setStatus('sem-cofre')
  }, [])

  // Abertura do app: reidrata cache, fila e chaves persistidas (sem Google) e,
  // se já existe cofre neste dispositivo, abre direto — sem pedir a senha.
  useEffect(() => {
    if (inicializadoRef.current) return
    inicializadoRef.current = true
    void (async () => {
      try {
        await iniciarCache()
        await iniciarOutbox()
        await carregarSessoes()
        setPendentes(contarPendencias())
        const ws = lerWorkspace()
        if (!ws) return
        aplicarWorkspace(ws)
        if (!obterSessao(ws.vaultId)) {
          setStatus('bloqueado')
          return
        }
        await aplicacaoVault.carregarVaultDoCache(ctx)
        setStatus('pronto')
      } catch {
        setStatus('bloqueado')
      }
    })()
  }, [ctx, aplicarWorkspace])

  const carregarConteudo = useCallback(async () => {
    if (lerManifestoCache(vaultIdRef.current)) {
      await aplicacaoVault.carregarVaultDoCache(ctx)
      return
    }
    if (ctx.vinculado() && onlineRef.current) {
      await aplicacaoVault.carregarVault(ctx)
      return
    }
    await aplicacaoVault.carregarVaultDoCache(ctx)
  }, [ctx])

  const entrarNoCofre = useCallback(
    async (senha: string) => {
      setErro(null)
      try {
        await iniciarCache()
        await iniciarOutbox()

        // Sem cofre neste dispositivo: cria um cofre local, sem Google.
        if (!vaultIdRef.current) {
          const novo = await aplicacaoVault.criarCofreLocal(senha)
          aplicarWorkspace({ vaultId: novo.vaultId, folderId: '', arquivoId: '' })
          ctx.definirSessao(novo.sessao)
          ctx.definirManifesto(novo.manifesto)
          setStatus('pronto')
          return
        }

        const ok = await aplicacaoCripto.desbloquear(ctx, senha)
        if (!ok) {
          setErro('Senha incorreta')
          return
        }
        await carregarConteudo()
        setStatus('pronto')
      } catch (e) {
        if (e instanceof TokenExpiradoError) {
          setSessaoExpirada(true)
          setErro('Sessão com o Google expirada. Toque em "Não sincronizado" para reconectar.')
          return
        }
        setErro(mensagem(e))
      }
    },
    [ctx, carregarConteudo, aplicarWorkspace],
  )

  const desbloquear = useCallback(
    async (senha: string) => {
      if (!vaultIdRef.current) {
        await entrarNoCofre(senha)
        return Boolean(manifestoRef.current)
      }
      setErro(null)
      try {
        await iniciarCache()
        await iniciarOutbox()
        const ok = await aplicacaoCripto.desbloquear(ctx, senha)
        if (!ok) {
          setErro('Senha incorreta')
          return false
        }
        await carregarConteudo()
        setStatus('pronto')
        return true
      } catch (e) {
        if (e instanceof TokenExpiradoError) {
          setSessaoExpirada(true)
          setErro('Sessão com o Google expirada. Toque em "Não sincronizado" para reconectar.')
        } else {
          setErro(mensagem(e))
        }
        return false
      }
    },
    [ctx, carregarConteudo, entrarNoCofre],
  )

  const apagarCofre = useCallback(async () => {
    setErro(null)
    try {
      // Apaga só o que pertence a este cofre (manifesto + blobs conhecidos) —
      // outra pasta/cofre do usuário não é afetado.
      if (ctx.vinculado() && onlineRef.current && auth.token) {
        const token = await auth.garantirToken()
        const blobs = (manifestoRef.current?.itens ?? [])
          .map((i) => i.blobId)
          .filter((blobId) => Boolean(blobId) && blobId !== '')
        for (const blobId of blobs) {
          await excluirArquivo(token, blobId).catch(() => undefined)
        }
        if (arquivoIdRef.current) await excluirArquivo(token, arquivoIdRef.current).catch(() => undefined)
      }
      const itemIds = manifestoRef.current?.itens.map((i) => i.id) ?? []
      await iniciarCache()
      await limparCofreCache(vaultIdRef.current, itemIds)
      await removerSessao(vaultIdRef.current)
      removerVerificador(vaultIdRef.current)
      await limparFila()
      limparEstado()
    } catch (e) {
      if (e instanceof TokenExpiradoError) {
        setSessaoExpirada(true)
        setErro('Sessão com o Google expirada. Toque em "Não sincronizado" para reconectar.')
        return
      }
      setErro(mensagem(e))
    }
  }, [auth, ctx, limparEstado])

  const bloquear = useCallback(() => {
    aplicacaoCripto.bloquear(ctx)
    manifestoRef.current = null
    setManifesto(null)
    setStatus('bloqueado')
  }, [ctx])

  /**
   * "Desconectar": descarta apenas o acesso ao Google. O cofre continua aberto
   * e utilizável localmente; o botão "Não sincronizado" volta a aparecer.
   */
  const logout = useCallback(() => {
    auth.logout()
    setSessaoExpirada(false)
    setConflito(null)
  }, [auth])

  const sincronizar = useCallback(async () => {
    if (!ctx.vinculado()) return 0
    try {
      const n = await aplicacaoSync.sincronizar(ctx)
      setPendentes(contarPendencias())
      setSessaoExpirada(false)
      return n
    } catch (e) {
      if (e instanceof TokenExpiradoError) {
        setSessaoExpirada(true)
        return 0
      }
      throw e
    }
  }, [ctx])

  /** Fluxo do botão vermelho: login/token + criar ou atualizar o cofre no Drive. */
  const sincronizarDrive = useCallback(async () => {
    setErro(null)
    if (statusRef.current !== 'pronto') {
      throw new Error('Desbloqueie o cofre antes de sincronizar.')
    }
    if (!auth.configurado) throw new Error('VITE_GOOGLE_CLIENT_ID não configurado')
    setSincronizando(true)
    try {
      await auth.garantirToken()
      setSessaoExpirada(false)

      // Reaplica o que ficou pendente enquanto estava offline no cofre já vinculado.
      let enviados = 0
      if (ctx.vinculado()) {
        try {
          enviados += await aplicacaoSync.sincronizar(ctx)
        } catch {
          /* a conexão abaixo resolve o que faltar */
        }
      }

      const resultado = await conectarCofreAoServidor(ctx, FOLDER_NAME)
      aplicarWorkspace({
        vaultId: vaultIdRef.current,
        folderId: resultado.folderId,
        arquivoId: resultado.arquivoId,
      })
      ctx.definirManifesto(resultado.manifesto)
      setConflito(null)
      setPendentes(contarPendencias())
      return { enviados: enviados + resultado.enviados, recebidos: resultado.recebidos }
    } catch (e) {
      if (e instanceof ConflitoDeSenhaError) {
        setConflito({ folderId: e.folderId })
      } else if (e instanceof TokenExpiradoError) {
        setSessaoExpirada(true)
      }
      throw e
    } finally {
      setSincronizando(false)
    }
  }, [auth, ctx, aplicarWorkspace])

  /** Opção 1 do conflito: abrir o cofre do Drive com a senha correta. */
  const usarCofreDoDrive = useCallback(
    async (senha: string) => {
      const atual = conflitoRef.current
      if (!atual) throw new Error('Nenhum cofre em conflito para abrir.')
      setSincronizando(true)
      try {
        const adotado = await adotarCofreDoDrive(ctx, atual.folderId, senha)
        aplicarWorkspace({
          vaultId: vaultIdRef.current,
          folderId: atual.folderId,
          arquivoId: adotado.arquivoId,
        })
        ctx.definirManifesto(adotado.manifesto)
        await limparFila()
        setPendentes(contarPendencias())
        setConflito(null)
        setSessaoExpirada(false)
        setErro(null)
      } catch (e) {
        setErro(mensagem(e))
        throw e
      } finally {
        setSincronizando(false)
      }
    },
    [ctx, aplicarWorkspace],
  )

  /** Opção 2 do conflito: guardar o cofre antigo (renomeando a pasta) e criar outro. */
  const criarNovoCofreNoDrive = useCallback(async () => {
    setSincronizando(true)
    try {
      const token = await auth.garantirToken()
      const sufixo = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      await arquivarPastaApp(token, FOLDER_NAME, sufixo)
      const resultado = await conectarCofreAoServidor(ctx, FOLDER_NAME)
      aplicarWorkspace({
        vaultId: vaultIdRef.current,
        folderId: resultado.folderId,
        arquivoId: resultado.arquivoId,
      })
      ctx.definirManifesto(resultado.manifesto)
      setConflito(null)
      setSessaoExpirada(false)
      setErro(null)
      setPendentes(contarPendencias())
      return { enviados: resultado.enviados, recebidos: resultado.recebidos }
    } catch (e) {
      setErro(mensagem(e))
      throw e
    } finally {
      setSincronizando(false)
    }
  }, [auth, ctx, aplicarWorkspace])

  const limparConflito = useCallback(() => setConflito(null), [])

  /**
   * Encapsula operações que podem falhar por token expirado (HTTP 401): nesse
   * caso marca a sessão como expirada e devolve uma mensagem amigável.
   */
  const comAuth = useCallback(async <T,>(op: () => Promise<T>): Promise<T> => {
    try {
      return await op()
    } catch (e) {
      if (e instanceof TokenExpiradoError) {
        setSessaoExpirada(true)
        throw new Error('Sessão com o Google expirada. Toque em "Não sincronizado" para reconectar.')
      }
      throw e
    }
  }, [])

  const criarPasta = useCallback(
    async (nome: string, parentId: PastaId | null) => {
      await comAuth(() => aplicacaoPastas.criarPasta(ctx, nome, parentId))
    },
    [ctx, comAuth],
  )
  const renomearPasta = useCallback(
    (id: string, nome: string) => comAuth(() => aplicacaoPastas.renomearPastaUseCase(ctx, id, nome)),
    [ctx, comAuth],
  )
  const excluirPasta = useCallback(
    (id: string) => comAuth(() => aplicacaoPastas.excluirPastaUseCase(ctx, id)),
    [ctx, comAuth],
  )
  const enviar = useCallback(
    async (arquivo: ArquivoUpload) => {
      await comAuth(() => aplicacaoItens.enviarArquivo(ctx, arquivo))
    },
    [ctx, comAuth],
  )
  const atualizarItem = useCallback(
    (id: string, nome: string, mime: string, bytes: Uint8Array) =>
      comAuth(() => aplicacaoItens.atualizarItemConteudo(ctx, id, nome, mime, bytes)),
    [ctx, comAuth],
  )
  const renomearItem = useCallback(
    (id: string, nome: string) => comAuth(() => aplicacaoItens.renomearItemUseCase(ctx, id, nome)),
    [ctx, comAuth],
  )
  const moverItem = useCallback(
    (id: string, pastaId: PastaId | null) => comAuth(() => aplicacaoItens.moverItemUseCase(ctx, id, pastaId)),
    [ctx, comAuth],
  )
  const excluirItem = useCallback(
    (id: string) => comAuth(() => aplicacaoItens.excluirItemUseCase(ctx, id)),
    [ctx, comAuth],
  )
  const abrirItem = useCallback(
    (item: Item) => comAuth(() => aplicacaoPreview.abrirItem(ctx, item)),
    [ctx, comAuth],
  )
  const compartilhar = useCallback(
    (item: Item) => comAuth(() => aplicacaoShare.compartilharItem(ctx, item)),
    [ctx, comAuth],
  )
  const salvarNota = useCallback(
    (titulo: string, conteudo: string, tipo: TipoNota, pastaId: PastaId | null) =>
      comAuth(() => aplicacaoEditor.salvarNota(ctx, titulo, conteudo, tipo, pastaId)),
    [ctx, comAuth],
  )
  const processarRecebidos = useCallback(
    (pastaId: PastaId | null, onLog?: (msg: string) => void) => {
      if (!importacaoRecebidosRef.current) {
        importacaoRecebidosRef.current = comAuth(() =>
          aplicacaoRecebidos.processarRecebidos(ctx, pastaId, onLog),
        ).finally(() => {
          importacaoRecebidosRef.current = null
        })
      }
      return importacaoRecebidosRef.current
    },
    [ctx, comAuth],
  )

  useEffect(() => {
    setPendentes(contarPendencias())
  }, [manifesto])

  // Ao reconectar, reaplica as mutações pendentes do outbox (cofre vinculado).
  const esteveOnline = useRef(online)
  useEffect(() => {
    const reconectou = online && !esteveOnline.current
    esteveOnline.current = online
    if (reconectou && statusRef.current === 'pronto') {
      void sincronizar().catch(() => {
        /* outros erros ficam visíveis na próxima ação do usuário */
      })
    }
  }, [online, sincronizar])

  // Ao abrir o cofre já online, sincroniza eventuais pendências deixadas por
  // uma sessão offline anterior.
  useEffect(() => {
    if (status === 'pronto' && onlineRef.current && vinculado) {
      void sincronizar().catch(() => {
        /* outros erros ficam visíveis na próxima ação do usuário */
      })
    }
  }, [status, vinculado, sincronizar])

  // Token expirado enquanto o cofre está aberto: o botão vermelho assume.
  useEffect(() => {
    if (!auth.token) return
    setSessaoExpirada(tokenExpirado(auth.token))
  }, [auth.token])

  const sincronizado = vinculado && Boolean(auth.token) && !sessaoExpirada && pendentes === 0

  const value = useMemo<VaultContextValue>(
    () => ({
      status,
      vaultId: workspace.vaultId,
      folderId: workspace.folderId,
      arquivoId: workspace.arquivoId,
      manifesto,
      email: auth.email,
      autenticado: Boolean(auth.token),
      configurado: auth.configurado,
      vinculado,
      sincronizado,
      sincronizando,
      conflito,
      erro,
      pendentes,
      cofreExiste,
      sessaoExpirada,
      login: auth.login,
      logout,
      sincronizarDrive,
      usarCofreDoDrive,
      criarNovoCofreNoDrive,
      limparConflito,
      entrarNoCofre,
      apagarCofre,
      desbloquear,
      bloquear,
      criarPasta,
      renomearPasta,
      excluirPasta,
      enviar,
      atualizarItem,
      renomearItem,
      moverItem,
      excluirItem,
      abrirItem,
      compartilhar,
      salvarNota,
      processarRecebidos,
      sincronizar,
    }),
    [
      status,
      workspace,
      manifesto,
      auth.email,
      auth.token,
      auth.configurado,
      auth.login,
      vinculado,
      sincronizado,
      sincronizando,
      conflito,
      erro,
      pendentes,
      cofreExiste,
      sessaoExpirada,
      logout,
      sincronizarDrive,
      usarCofreDoDrive,
      criarNovoCofreNoDrive,
      limparConflito,
      entrarNoCofre,
      apagarCofre,
      desbloquear,
      bloquear,
      criarPasta,
      renomearPasta,
      excluirPasta,
      enviar,
      atualizarItem,
      renomearItem,
      moverItem,
      excluirItem,
      abrirItem,
      compartilhar,
      salvarNota,
      processarRecebidos,
      sincronizar,
    ],
  )

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>
}

export function useVault(): VaultContextValue {
  const ctx = useContext(VaultContext)
  if (!ctx) throw new Error('useVault deve ser usado dentro de VaultProvider')
  return ctx
}
