import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Item, Manifesto, PastaId } from '@/domain/entities'
import type { TipoNota } from '@/domain/editor'
import type { TipoPreview } from '@/domain/preview'
import type { ContextoVault } from '@/application/contexto'
import * as aplicacaoCripto from '@/application/criptografia'
import * as aplicacaoEditor from '@/application/editor'
import * as aplicacaoItens from '@/application/itens'
import * as aplicacaoPastas from '@/application/pastas'
import * as aplicacaoPreview from '@/application/preview'
import * as aplicacaoRecebidos from '@/application/recebidos'
import * as aplicacaoShare from '@/application/share'
import * as aplicacaoSync from '@/application/sync'
import * as aplicacaoVault from '@/application/vault'
import { guardarSessao, obterSessao, removerSessao } from '@/infrastructure/cripto/chaveSessao'
import { listarArquivos } from '@/infrastructure/drive/api'
import { garantirPastaApp } from '@/infrastructure/drive/pasta'
import { criarSharePort } from '@/infrastructure/share/navegadorShare'
import { criarShareTargetPort } from '@/infrastructure/share/inboxShareTarget'
import { decorarItemStore } from '@/infrastructure/storage/offlineRepositories'
import { iniciarCache } from '@/infrastructure/storage/cache'
import { contarPendencias, iniciarOutbox } from '@/infrastructure/storage/outbox'
import { criarDriveItemStore } from '@/infrastructure/vault/itemStore'
import { criarDriveVaultRepository } from '@/infrastructure/vault/vaultRepository'
import { useOnlineStatus } from '@/presentation/hooks/useOnlineStatus'
import { useAuth } from './authProvider'

const FOLDER_NAME = (import.meta.env.VITE_VAULT_FOLDER_NAME as string | undefined) ?? 'mydocs_vault'
const WORKSPACE_KEY = 'mydocs:workspace'

export type StatusVault = 'sem-cofre' | 'bloqueado' | 'pronto'

export interface ArquivoUpload {
  nome: string
  mime: string
  bytes: Uint8Array
  pastaId: PastaId | null
}

interface VaultContextValue {
  status: StatusVault
  vaultId: string
  manifesto: Manifesto | null
  email: string | null
  autenticado: boolean
  configurado: boolean
  erro: string | null
  pendentes: number
  login(): Promise<void>
  logout(): void
  criarCofre(senha: string): Promise<void>
  abrirCofre(senha: string): Promise<void>
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
  processarRecebidos(pastaId: PastaId | null): Promise<number>
  sincronizar(): Promise<number>
}

const VaultContext = createContext<VaultContextValue | null>(null)

function mensagem(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
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

  const vaultIdRef = useRef('')
  const folderIdRef = useRef('')
  const etagRef = useRef<string | undefined>(undefined)
  const manifestoRef = useRef<Manifesto | null>(null)
  const importouRecebidosRef = useRef(false)

  const sharePort = useMemo(() => criarSharePort(), [])
  const shareTargetPort = useMemo(() => criarShareTargetPort(), [])

  const ctx = useMemo<ContextoVault>(
    () => ({
      get vaultId() {
        return vaultIdRef.current
      },
      get folderId() {
        return folderIdRef.current
      },
      tokenProvider: () => auth.tokenProvider(),
      online: () => onlineRef.current,
      get itemStore() {
        return decorarItemStore(
          criarDriveItemStore({
            tokenProvider: () => auth.tokenProvider(),
            folderId: folderIdRef.current,
          }),
          () => onlineRef.current,
        )
      },
      get vaultRepository() {
        return criarDriveVaultRepository({
          tokenProvider: () => auth.tokenProvider(),
          vaultFileId: vaultIdRef.current,
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
      definirSessao: (sessao) => guardarSessao(vaultIdRef.current, sessao),
      limparSessao: () => removerSessao(vaultIdRef.current),
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

  function salvarWorkspace(): void {
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify({ vaultId: vaultIdRef.current, folderId: folderIdRef.current }))
  }

  const criarCofre = useCallback(
    async (senha: string) => {
      setErro(null)
      try {
        const token = await auth.tokenProvider()
        const novo = await aplicacaoVault.criarNovoCofre(token, senha, FOLDER_NAME)
        vaultIdRef.current = novo.vaultId
        folderIdRef.current = novo.folderId
        guardarSessao(novo.vaultId, novo.sessao)
        salvarWorkspace()
        await iniciarCache()
        await iniciarOutbox()
        await aplicacaoVault.carregarVault(ctx)
        setStatus('pronto')
      } catch (e) {
        setErro(mensagem(e))
      }
    },
    [auth, ctx],
  )

  const abrirCofre = useCallback(
    async (senha: string) => {
      setErro(null)
      try {
        const token = await auth.tokenProvider()
        const folderId = await garantirPastaApp(token, FOLDER_NAME)
        const arquivos = await listarArquivos(token, folderId)
        const manifest = arquivos.find((a) => a.name === 'mydocs.manifest')
        if (!manifest) throw new Error('Nenhum cofre encontrado na sua conta. Crie um novo.')
        vaultIdRef.current = manifest.id
        folderIdRef.current = folderId
        salvarWorkspace()
        const ok = await aplicacaoCripto.desbloquear(ctx, senha)
        if (!ok) {
          setErro('Senha incorreta')
          return
        }
        await iniciarCache()
        await iniciarOutbox()
        await aplicacaoVault.carregarVault(ctx)
        setStatus('pronto')
      } catch (e) {
        setErro(mensagem(e))
      }
    },
    [auth, ctx],
  )

  const desbloquear = useCallback(
    async (senha: string) => {
      setErro(null)
      try {
        const ok = await aplicacaoCripto.desbloquear(ctx, senha)
        if (!ok) {
          setErro('Senha incorreta')
          return false
        }
        await iniciarCache()
        await iniciarOutbox()
        await aplicacaoVault.carregarVault(ctx)
        setStatus('pronto')
        return true
      } catch (e) {
        setErro(mensagem(e))
        return false
      }
    },
    [ctx],
  )

  const bloquear = useCallback(() => {
    aplicacaoCripto.bloquear(ctx)
    manifestoRef.current = null
    setManifesto(null)
    setStatus('bloqueado')
  }, [ctx])

  const logout = useCallback(() => {
    auth.logout()
    removerSessao(vaultIdRef.current)
    vaultIdRef.current = ''
    folderIdRef.current = ''
    etagRef.current = undefined
    manifestoRef.current = null
    setManifesto(null)
    localStorage.removeItem(WORKSPACE_KEY)
    setStatus('sem-cofre')
  }, [auth])

  useEffect(() => {
    if (!auth.token) {
      if (status !== 'sem-cofre') logout()
      return
    }
    const ws = localStorage.getItem(WORKSPACE_KEY)
    if (ws && status === 'sem-cofre') {
      try {
        const { vaultId, folderId } = JSON.parse(ws) as { vaultId: string; folderId: string }
        vaultIdRef.current = vaultId
        folderIdRef.current = folderId
        setStatus('bloqueado')
      } catch {
        /* workspace inválido */
      }
    }
  }, [auth.token, status, logout])

  const criarPasta = useCallback(async (nome: string, parentId: PastaId | null) => {
    await aplicacaoPastas.criarPasta(ctx, nome, parentId)
  }, [ctx])
  const renomearPasta = useCallback((id: string, nome: string) => aplicacaoPastas.renomearPastaUseCase(ctx, id, nome), [ctx])
  const excluirPasta = useCallback((id: string) => aplicacaoPastas.excluirPastaUseCase(ctx, id), [ctx])
  const enviar = useCallback(async (arquivo: ArquivoUpload) => {
    await aplicacaoItens.enviarArquivo(ctx, arquivo)
  }, [ctx])
  const atualizarItem = useCallback(
    (id: string, nome: string, mime: string, bytes: Uint8Array) =>
      aplicacaoItens.atualizarItemConteudo(ctx, id, nome, mime, bytes),
    [ctx],
  )
  const renomearItem = useCallback((id: string, nome: string) => aplicacaoItens.renomearItemUseCase(ctx, id, nome), [ctx])
  const moverItem = useCallback(
    (id: string, pastaId: PastaId | null) => aplicacaoItens.moverItemUseCase(ctx, id, pastaId),
    [ctx],
  )
  const excluirItem = useCallback((id: string) => aplicacaoItens.excluirItemUseCase(ctx, id), [ctx])
  const abrirItem = useCallback((item: Item) => aplicacaoPreview.abrirItem(ctx, item), [ctx])
  const compartilhar = useCallback((item: Item) => aplicacaoShare.compartilharItem(ctx, item), [ctx])
  const salvarNota = useCallback(
    (titulo: string, conteudo: string, tipo: TipoNota, pastaId: PastaId | null) =>
      aplicacaoEditor.salvarNota(ctx, titulo, conteudo, tipo, pastaId),
    [ctx],
  )
  const processarRecebidos = useCallback(
    (pastaId: PastaId | null) => aplicacaoRecebidos.processarRecebidos(ctx, pastaId),
    [ctx],
  )
  const sincronizar = useCallback(async () => {
    const n = await aplicacaoSync.sincronizar(ctx)
    setPendentes(contarPendencias())
    return n
  }, [ctx])

  useEffect(() => {
    setPendentes(contarPendencias())
  }, [manifesto])

  // Importa automaticamente arquivos compartilhados (Web Share Target) assim
  // que o cofre é desbloqueado e o manifesto carregado.
  useEffect(() => {
    if (status !== 'pronto') {
      importouRecebidosRef.current = false
      return
    }
    if (importouRecebidosRef.current) return
    importouRecebidosRef.current = true
    void aplicacaoRecebidos.processarRecebidos(ctx, null).catch(() => {
      /* pendências ficam para a tela de Recebidos */
    })
  }, [status, ctx])

  const value = useMemo<VaultContextValue>(
    () => ({
      status,
      vaultId: vaultIdRef.current,
      manifesto,
      email: auth.email,
      autenticado: Boolean(auth.token),
      configurado: auth.configurado,
      erro,
      pendentes,
      login: auth.login,
      logout,
      criarCofre,
      abrirCofre,
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
      manifesto,
      auth.email,
      auth.token,
      auth.configurado,
      auth.login,
      erro,
      pendentes,
      logout,
      criarCofre,
      abrirCofre,
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
