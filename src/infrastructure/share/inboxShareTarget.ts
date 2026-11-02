import type { ShareTargetPort } from '@/domain/ports'
import { base64ParaBytes } from '@/infrastructure/cripto/webCrypto'
import { iniciarKv, listarSync, remover } from '@/infrastructure/storage/kvStore'

const STORE = 'inbox'

export function criarShareTargetPort(): ShareTargetPort {
  return {
    async lerRecebidos() {
      await iniciarKv(STORE)
      const entradas = listarSync(STORE)
      const files = entradas
        .map((e) => {
          try {
            const f = JSON.parse(e.value) as { nome: string; mime: string; bytesB64: string }
            return { nome: f.nome, mime: f.mime, bytes: base64ParaBytes(f.bytesB64) }
          } catch {
            return null
          }
        })
        .filter((f): f is { nome: string; mime: string; bytes: Uint8Array } => f !== null)
      for (const e of entradas) await remover(STORE, e.key)
      return { files }
    },
  }
}
