import type { ItemStore } from '@/domain/ports'
import { bytesBase64 } from '@/infrastructure/cripto/webCrypto'
import { enfileirar } from './outbox'

/**
 * Decorador que roteia escritas para o outbox quando offline. A leitura
 * continua no repositório base (o cache local alimenta a UI); o replay da fila
 * acontece na reconexão, via application/sync.
 */
export function decorarItemStore(base: ItemStore, online: () => boolean): ItemStore {
  return {
    async enviar(itemId, envelope, mime) {
      if (!online()) {
        await enfileirar({ tipo: 'upload', itemId, mime, envelopeB64: bytesBase64(envelope) })
        return itemId
      }
      return base.enviar(itemId, envelope, mime)
    },
    baixar(blobId) {
      return base.baixar(blobId)
    },
    async excluir(blobId) {
      if (!online()) {
        await enfileirar({ tipo: 'excluirBlob', blobId })
        return
      }
      return base.excluir(blobId)
    },
  }
}
