import { abrirBanco } from '@/infrastructure/storage/db'
import { base64ParaBytes, bytesBase64 } from './webCrypto'

export interface SessaoCripto {
  chave: CryptoKey
  salt: Uint8Array
  iterations: number
}

interface RegistroSessao {
  chave: CryptoKey
  salt: string
  iterations: number
}

const STORE = 'chaves'
const sessoes = new Map<string, SessaoCripto>()

export function obterSessao(id: string): SessaoCripto | undefined {
  return sessoes.get(id)
}

/** Guarda a chave apenas em memória (sessões efêmeras, como nos testes). */
export function guardarSessao(id: string, sessao: SessaoCripto): void {
  sessoes.set(id, sessao)
}

/**
 * Guarda a chave em memória e no IndexedDB, para que o cofre continue aberto
 * depois de recarregar a página — sem pedir a senha novamente e sem Google.
 * A chave é derivada como não-exportável, então só o próprio navegador pode
 * usá-la; o material da senha nunca é gravado.
 */
export async function persistirSessao(id: string, sessao: SessaoCripto): Promise<void> {
  sessoes.set(id, sessao)
  const registro: RegistroSessao = {
    chave: sessao.chave,
    salt: bytesBase64(sessao.salt),
    iterations: sessao.iterations,
  }
  const db = await abrirBanco()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(registro, id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/**
 * Rehidrata as chaves persistidas. Deve ser chamada uma vez na abertura do app,
 * antes de tentar carregar o cofre do cache.
 */
export async function carregarSessoes(): Promise<void> {
  const db = await abrirBanco()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).openCursor()
    req.onsuccess = () => {
      const cursor = req.result
      if (cursor) {
        const registro = cursor.value as RegistroSessao
        if (registro?.chave) {
          sessoes.set(String(cursor.key), {
            chave: registro.chave,
            salt: base64ParaBytes(registro.salt),
            iterations: registro.iterations,
          })
        }
        cursor.continue()
      } else {
        resolve()
      }
    }
    req.onerror = () => reject(req.error)
  })
}

export async function removerSessao(id: string): Promise<void> {
  sessoes.delete(id)
  const db = await abrirBanco()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export function limparSessoes(): void {
  sessoes.clear()
}
