/// <reference lib="webworker" />
import { createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare let self: ServiceWorkerGlobalScope

const GOOGLE_ORIGINS_REGEX = /^https:\/\/(?:accounts|apis|www)\.googleapis?\.com\/.*/i

precacheAndRoute(self.__WB_MANIFEST)

// SPA fallback dentro do subdiretório do GitHub Pages (sem cachear os domínios do Google).
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/mydocs/index.html'), {
    denylist: [GOOGLE_ORIGINS_REGEX],
  }),
)

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

function sanitizarNome(nome: string): string {
  return nome
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
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

    // Texto e/ou link compartilhados viram uma nota no cofre.
    const title = typeof formData.get('title') === 'string' ? (formData.get('title') as string) : ''
    const text = typeof formData.get('text') === 'string' ? (formData.get('text') as string) : ''
    const url = typeof formData.get('url') === 'string' ? (formData.get('url') as string) : ''
    if (text || url) {
      let nome: string
      let mime: string
      let conteudo: string
      if (url) {
        nome = `${sanitizarNome(title) || 'link'}.md`
        mime = 'text/markdown'
        conteudo = text ? `${text}\n\n[${title || url}](${url})` : `[${title || url}](${url})`
      } else {
        nome = `${sanitizarNome(title) || 'nota'}.txt`
        mime = 'text/plain'
        conteudo = text
      }
      store.put(
        JSON.stringify({
          nome,
          mime,
          bytesB64: bytesParaBase64(new TextEncoder().encode(conteudo).buffer),
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
