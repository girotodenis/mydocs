import type { ItemStore } from '@/domain/ports'
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
