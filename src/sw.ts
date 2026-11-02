/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching'

declare let self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)

const INBOX_DB = 'mydocs'
const INBOX_STORE = 'inbox'

function abrirDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(INBOX_DB, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(INBOX_STORE)) db.createObjectStore(INBOX_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function bytesParaBase64(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes)
  let bin = ''
  for (const b of arr) bin += String.fromCharCode(b)
  return btoa(bin)
}

async function processarShare(request: Request): Promise<Response> {
  try {
    const formData = await request.formData()
    const db = await abrirDb()
    const tx = db.transaction(INBOX_STORE, 'readwrite')
    const store = tx.objectStore(INBOX_STORE)
    const files = formData.getAll('file') as File[]
    for (const file of files) {
      const buffer = await file.arrayBuffer()
      store.put(
        JSON.stringify({
          nome: file.name,
          mime: file.type || 'application/octet-stream',
          bytesB64: bytesParaBase64(buffer),
        }),
        crypto.randomUUID(),
      )
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // mesmo em falha, redireciona para a tela de Recebidos
  }
  return Response.redirect('./recebidos', 303)
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method === 'POST' && url.pathname.endsWith('/share-target')) {
    event.respondWith(processarShare(event.request))
  }
})
