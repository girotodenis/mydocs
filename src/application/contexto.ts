import type { Manifesto } from '@/domain/entities'
import type { ItemStore, SharePort, ShareTargetPort, VaultRepository } from '@/domain/ports'
import type { SessaoCripto } from '@/infrastructure/cripto/chaveSessao'

export interface ContextoVault {
  /** Identidade local do cofre (estável, usada nas chaves de cache). */
  readonly vaultId: string
  /** Id do arquivo do manifesto no Drive (vazio enquanto não houver vínculo). */
  readonly arquivoId: string
  readonly folderId: string
  /** Indica se o cofre está vinculado a uma pasta/arquivo no Google Drive. */
  vinculado(): boolean
  tokenProvider(): Promise<string>
  online(): boolean
  itemStore: ItemStore
  vaultRepository: VaultRepository
  sharePort: SharePort
  shareTargetPort: ShareTargetPort
  obterSessao(): SessaoCripto | undefined
  definirSessao(sessao: SessaoCripto): void
  limparSessao(): void
  obterEtag(): string | undefined
  definirEtag(etag?: string): void
  lerManifesto(): Manifesto | null
  definirManifesto(manifesto: Manifesto | null): void
}
