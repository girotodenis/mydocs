import type { Manifesto } from '@/domain/entities'
import type { ItemStore } from '@/domain/ports'
import { lerItemCache, removerItemCache } from '@/infrastructure/storage/cache'
import * as drive from '../drive/api'

export interface DepsItemStore {
  tokenProvider: () => Promise<string>
  folderId: string
}

export function criarDriveItemStore(deps: DepsItemStore): ItemStore {
  return {
    async enviar(itemId, envelope) {
      const token = await deps.tokenProvider()
      return drive.criarArquivoMultipart(token, itemId, envelope, deps.folderId)
    },
    async baixar(blobId) {
      const token = await deps.tokenProvider()
      const { bytes } = await drive.baixarArquivoComEtag(token, blobId)
      return bytes
    },
    async excluir(blobId) {
      const token = await deps.tokenProvider()
      await drive.excluirArquivo(token, blobId)
    },
  }
}

export interface DepsItemStoreLocal {
  vaultId: string
  obterManifesto: () => Manifesto | null
}

/**
 * ItemStore sem Google Drive: os casos de uso já gravam o envelope no cache
 * local, então aqui só resolvemos leitura e remoção por `blobId`/`itemId`.
 */
export function criarItemStoreLocal(deps: DepsItemStoreLocal): ItemStore {
  function resolverId(blobId: string): string {
    const item = deps.obterManifesto()?.itens.find((i) => i.blobId === blobId || i.id === blobId)
    return item?.id ?? blobId
  }

  return {
    async enviar(itemId) {
      return itemId
    },
    async baixar(blobId) {
      const envelope = lerItemCache(deps.vaultId, resolverId(blobId))
      if (!envelope) throw new Error('Conteúdo não disponível neste dispositivo.')
      return envelope
    },
    async excluir(blobId) {
      await removerItemCache(deps.vaultId, resolverId(blobId))
    },
  }
}

