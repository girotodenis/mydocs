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
import { obterSaltVerificador, removerVerificador } from '@/infrastructure/cripto/verificadorLocal'
import { biometriaConfigurada, removerBiometria, suporteBiometria } from '@/infrastructure/cripto/biometria'
import { excluirArquivo, listarArquivos, TokenExpiradoError } from '@/infrastructure/drive/api'
import { garantirPastaApp } from '@/infrastructure/drive/pasta'
import { criarSharePort } from '@/infrastructure/share/navegadorShare'
import { criarShareTargetPort } from '@/infrastructure/share/inboxShareTarget'
import { decorarItemStore } from '@/infrastructure/storage/offlineRepositories'
import { iniciarCache, lerManifestoCache } from '@/infrastructure/storage/cache'
import { contarPendencias, iniciarOutbox } from '@/infrastructure/storage/outbox'
import { criarDriveItemStore } from '@/infrastructure/vault/itemStore'
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

interface VaultContextValue {
  status: StatusVault
  vaultId: string
  folderId: string
  manifesto: Manifesto | null
  email: string | null
  autenticado: boolean
  configurado: boolean
  erro: string | null
  pendentes: number
  cofreExiste: boolean
  sessaoExpirada: boolean
  login(): Promise<void>
  logout(): void
  relogar(): Promise<void>
  entrarNoCofre(senha: string): Promise<void>
  apagarCofre(): Promise<void>
  desbloquear(senha: string): Promise<boolean>
  desbloquearComBiometria(): Promise<boolean>
  biometriaSuportada: boolean
  biometriaAtiva: boolean
  ativarBiometria(): Promise<void>
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
  const biometriaSuportada = useMemo(() => suporteBiometria(), [])
  const [biometriaAtiva, setBiometriaAtiva] = useState(false)

  const vaultIdRef = useRef('')
  const folderIdRef = useRef('')
  const statusRef = useRef<StatusVault>('sem-cofre')
  statusRef.current = status
  const etagRef = useRef<string | undefined>(undefined)
  const manifestoRef = useRef<Manifesto | null>(null)
  const importacaoRecebidosRef = useRef<Promise<number> | null>(null)

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
      tokenProvider: () => auth.garantirToken(),
      online: () => onlineRef.current,
      get itemStore() {
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

  const entrarNoCofre = useCallback(
    async (senha: string) => {
      setErro(null)
      try {
        // Sem internet: abre pelo verificador local + manifesto em cache.
        if (!onlineRef.current) {
          const ws = localStorage.getItem(WORKSPACE_KEY)
          if (!ws) {
            setErro('Sem conexão e sem cofre neste dispositivo. Conecte-se para abrir o cofre.')
            return
          }
          const { vaultId, folderId } = JSON.parse(ws) as { vaultId: string; folderId: string }
          vaultIdRef.current = vaultId
          folderIdRef.current = folderId
          setCofreExiste(true)
          if (!obterSaltVerificador(vaultId)) {
            setErro('Este cofre nunca foi aberto neste dispositivo. Conecte-se para desbloqueá-lo.')
            return
          }
          const ok = await aplicacaoCripto.desbloquear(ctx, senha)
          if (!ok) {
            setErro('Senha incorreta')
            return
          }
          await iniciarCache()
          await iniciarOutbox()
          await aplicacaoVault.carregarVaultDoCache(ctx)
          setStatus('pronto')
          return
        }

        // Online: usa o Google Drive (renova o token automaticamente se expirado).
        const token = await auth.garantirToken()
        const folderId = await garantirPastaApp(token, FOLDER_NAME)
        const arquivos = await listarArquivos(token, folderId)
        const manifest = arquivos.find((a) => a.name === 'mydocs.manifest')
        setCofreExiste(Boolean(manifest))

        if (!manifest) {
          // Cria um cofre novo nesta conta.
          const novo = await aplicacaoVault.criarNovoCofre(token, senha, FOLDER_NAME)
          vaultIdRef.current = novo.vaultId
          folderIdRef.current = novo.folderId
          guardarSessao(novo.vaultId, novo.sessao)
          salvarWorkspace()
          setCofreExiste(true)
          await iniciarCache()
          await iniciarOutbox()
          await aplicacaoVault.carregarVault(ctx)
          setStatus('pronto')
          return
        }

        // Abre o cofre existente.
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
        // Se há alterações offline pendentes, parte do cache local (que reflete
        // as edições feitas sem internet) para sincronizá-las com o Drive.
        if (contarPendencias() > 0 && lerManifestoCache(vaultIdRef.current)) {
          await aplicacaoVault.carregarVaultDoCache(ctx)
        } else {
          await aplicacaoVault.carregarVault(ctx)
        }
        setStatus('pronto')
      } catch (e) {
        if (e instanceof TokenExpiradoError) {
          setSessaoExpirada(true)
          setErro('Sessão com o Google expirada. Toque em "Entrar novamente" para reconectar.')
          return
        }
        setErro(mensagem(e))
      }
    },
    [auth, ctx],
  )

  const apagarCofre = useCallback(async () => {
    setErro(null)
    try {
      const token = await auth.garantirToken()
      const folderId = await garantirPastaApp(token, FOLDER_NAME)
      const arquivos = await listarArquivos(token, folderId)
      for (const arquivo of arquivos) {
        await excluirArquivo(token, arquivo.id)
      }
      removerSessao(vaultIdRef.current)
      removerVerificador(vaultIdRef.current)
      removerBiometria(vaultIdRef.current)
      localStorage.removeItem(WORKSPACE_KEY)
      vaultIdRef.current = ''
      folderIdRef.current = ''
      etagRef.current = undefined
      manifestoRef.current = null
      setManifesto(null)
      setCofreExiste(false)
      setStatus('sem-cofre')
    } catch (e) {
      if (e instanceof TokenExpiradoError) {
        setSessaoExpirada(true)
        setErro('Sessão com o Google expirada. Toque em "Entrar novamente" para reconectar.')
        return
      }
      setErro(mensagem(e))
    }
  }, [auth])

  const desbloquear = useCallback(
    async (senha: string) => {
      setErro(null)
      try {
        if (!onlineRef.current && !obterSaltVerificador(ctx.vaultId)) {
          setErro('Este cofre nunca foi aberto neste dispositivo. Conecte-se para desbloqueá-lo.')
          return false
        }
        const ok = await aplicacaoCripto.desbloquear(ctx, senha)
        if (!ok) {
          setErro('Senha incorreta')
          return false
        }
        await iniciarCache()
        await iniciarOutbox()
        if (onlineRef.current) {
          if (contarPendencias() > 0 && lerManifestoCache(ctx.vaultId)) {
            await aplicacaoVault.carregarVaultDoCache(ctx)
          } else {
            await aplicacaoVault.carregarVault(ctx)
          }
        } else {
          await aplicacaoVault.carregarVaultDoCache(ctx)
        }
        setStatus('pronto')
        return true
      } catch (e) {
        if (e instanceof TokenExpiradoError) {
          setSessaoExpirada(true)
          setErro('Sessão com o Google expirada. Toque em "Entrar novamente" para reconectar.')
        } else {
          setErro(mensagem(e))
        }
        return false
      }
    },
    [ctx],
  )

  const ativarBiometria = useCallback(async () => {
    const sessao = obterSessao(vaultIdRef.current)
    if (!sessao) throw new Error('Cofre não está desbloqueado.')
    await aplicacaoCripto.ativarBiometria(ctx, sessao, auth.email ?? '')
    setBiometriaAtiva(biometriaConfigurada(vaultIdRef.current))
  }, [auth.email, ctx])

  const desbloquearComBiometria = useCallback(async () => {
    setErro(null)
    try {
      const ok = await aplicacaoCripto.desbloquearComBiometria(ctx)
      if (!ok) {
        setErro('Não foi possível desbloquear com a biometria.')
        return false
      }
      await iniciarCache()
      await iniciarOutbox()
      if (onlineRef.current) {
        if (contarPendencias() > 0 && lerManifestoCache(ctx.vaultId)) {
          await aplicacaoVault.carregarVaultDoCache(ctx)
        } else {
          await aplicacaoVault.carregarVault(ctx)
        }
      } else {
        await aplicacaoVault.carregarVaultDoCache(ctx)
      }
      setStatus('pronto')
      return true
    } catch (e) {
      setErro(mensagem(e))
      return false
    }
  }, [ctx])

  const bloquear = useCallback(() => {
    aplicacaoCripto.bloquear(ctx)
    manifestoRef.current = null
    setManifesto(null)
    setStatus('bloqueado')
  }, [ctx])

  const logout = useCallback(() => {
    auth.logout()
    removerSessao(vaultIdRef.current)
    setCofreExiste(false)
    setSessaoExpirada(false)
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
    // Detecta token expirado logo na abertura, para avisar o usuário antes de
    // qualquer tentativa de acesso ao Drive.
    setSessaoExpirada(tokenExpirado(auth.token))
    const ws = localStorage.getItem(WORKSPACE_KEY)
    if (ws && status === 'sem-cofre') {
      try {
        const { vaultId, folderId } = JSON.parse(ws) as { vaultId: string; folderId: string }
        vaultIdRef.current = vaultId
        folderIdRef.current = folderId
        setCofreExiste(true)
        setStatus('bloqueado')
      } catch {
        /* workspace inválido */
      }
    }
  }, [auth.token, status, logout])

  // Mantém o indicador de biometria em sincronia com o que está gravado localmente.
  useEffect(() => {
    setBiometriaAtiva(biometriaSuportada && biometriaConfigurada(vaultIdRef.current))
  }, [biometriaSuportada, status])

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
        throw new Error('Sessão com o Google expirada. Toque em "Entrar novamente" para reconectar.')
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
  const sincronizar = useCallback(async () => {
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

  const relogar = useCallback(async () => {
    setErro(null)
    try {
      await auth.login()
      setSessaoExpirada(false)
      if (statusRef.current === 'pronto') {
        await sincronizar()
      }
    } catch (e) {
      setErro(mensagem(e))
    }
  }, [auth, sincronizar])

  useEffect(() => {
    setPendentes(contarPendencias())
  }, [manifesto])

  // Ao reconectar, reaplica as mutações pendentes do outbox.
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
    if (status === 'pronto' && onlineRef.current) {
      void sincronizar().catch(() => {
        /* outros erros ficam visíveis na próxima ação do usuário */
      })
    }
  }, [status, sincronizar])

  // A importação de conteúdos recebidos (Web Share Target) é disparada pela
  // tela de Recebidos — para onde o share target redireciona — e lá exibe o
  // indicador de progresso.

  const value = useMemo<VaultContextValue>(
    () => ({
      status,
      vaultId: vaultIdRef.current,
      folderId: folderIdRef.current,
      manifesto,
      email: auth.email,
      autenticado: Boolean(auth.token),
      configurado: auth.configurado,
      erro,
      pendentes,
      cofreExiste,
      sessaoExpirada,
      login: auth.login,
      logout,
      relogar,
      entrarNoCofre,
      apagarCofre,
      desbloquear,
      desbloquearComBiometria,
      biometriaSuportada,
      biometriaAtiva,
      ativarBiometria,
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
      cofreExiste,
      sessaoExpirada,
      logout,
      relogar,
      entrarNoCofre,
      apagarCofre,
      desbloquear,
      desbloquearComBiometria,
      biometriaSuportada,
      biometriaAtiva,
      ativarBiometria,
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
