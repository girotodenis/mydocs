import type { Manifesto } from '@/domain/entities'
import type { ItemStore, SharePort, ShareTargetPort, VaultRepository } from '@/domain/ports'

export interface ContextoVault {
  readonly vaultId: string
  readonly folderId: string
  tokenProvider(): Promise<string>
  online(): boolean
  itemStore: ItemStore
  vaultRepository: VaultRepository
  sharePort: SharePort
  shareTargetPort: ShareTargetPort
  obterChave(): CryptoKey | undefined
  definirChave(chave: CryptoKey): void
  limparChave(): void
  obterEtag(): string | undefined
  definirEtag(etag?: string): void
  lerManifesto(): Manifesto | null
  definirManifesto(manifesto: Manifesto | null): void
}
