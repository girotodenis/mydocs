import type { Manifesto } from '@/domain/entities'
import type { ItemStore, SharePort, ShareTargetPort, VaultRepository } from '@/domain/ports'
import type { SessaoCripto } from '@/infrastructure/cripto/chaveSessao'

export interface ContextoVault {
  readonly vaultId: string
  readonly folderId: string
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
