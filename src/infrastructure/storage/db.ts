const DB_NAME = 'mydocs'
const DB_VERSION = 1
const STORES = ['cache', 'outbox', 'inbox'] as const

let dbPromise: Promise<IDBDatabase> | null = null

export function abrirBanco(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

export function fecharBanco(): void {
  dbPromise = null
}
