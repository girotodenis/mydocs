import type { ShareTargetPort } from '@/domain/ports'
import { base64ParaBytes } from '@/infrastructure/cripto/webCrypto'
import { iniciarKv, listarSync, remover } from '@/infrastructure/storage/kvStore'

const STORE = 'inbox'

export function criarShareTargetPort(): ShareTargetPort {
  return {
    async lerRecebidos() {
      await iniciarKv(STORE)
      const entradas = listarSync(STORE)
      const files: { nome: string; mime: string; bytes: Uint8Array }[] = []
      const debug: string[] = []
      for (const e of entradas) {
        try {
          const parsed = JSON.parse(e.value) as {
            tipo?: string
            resumo?: string[]
            nome?: string
            mime?: string
            bytesB64?: string
          }
          if (parsed.tipo === 'debug') {
            if (Array.isArray(parsed.resumo)) debug.push(...parsed.resumo)
          } else if (parsed.nome && parsed.mime && parsed.bytesB64) {
            files.push({ nome: parsed.nome, mime: parsed.mime, bytes: base64ParaBytes(parsed.bytesB64) })
          }
        } catch {
          /* entrada inválida é ignorada */
        }
      }
      for (const e of entradas) await remover(STORE, e.key)
      return { files, debug }
    },
  }
}
