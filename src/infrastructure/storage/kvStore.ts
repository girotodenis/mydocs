import { abrirBanco } from './db'

const espelhos = new Map<string, Map<string, string>>()

function espelho(store: string): Map<string, string> {
  let m = espelhos.get(store)
  if (!m) {
    m = new Map()
    espelhos.set(store, m)
  }
  return m
}

export async function iniciarKv(store: string): Promise<void> {
  const db = await abrirBanco()
  const mirror = espelho(store)
  mirror.clear()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readonly')
    const req = tx.objectStore(store).openCursor()
    req.onsuccess = () => {
      const cursor = req.result
      if (cursor) {
        mirror.set(String(cursor.key), String(cursor.value))
        cursor.continue()
      } else {
        resolve()
      }
    }
    req.onerror = () => reject(req.error)
  })
}

export function lerSync(store: string, key: string): string | undefined {
  return espelho(store).get(key)
}

export function listarSync(store: string): { key: string; value: string }[] {
  return [...espelho(store).entries()].map(([key, value]) => ({ key, value }))
}

export async function gravar(store: string, key: string, value: string): Promise<void> {
  espelho(store).set(key, value)
  const db = await abrirBanco()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function remover(store: string, key: string): Promise<void> {
  espelho(store).delete(key)
  const db = await abrirBanco()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
