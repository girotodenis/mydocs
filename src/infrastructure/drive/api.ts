export interface DriveFileInfo {
  id: string
  name: string
  mimeType: string
  modifiedTime: string
}

const BASE = 'https://www.googleapis.com/drive/v3'

async function fetchComTimeout(url: string, init: RequestInit, timeoutMs = 15_000): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(timer)
  }
}

function auth(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` }
}

export async function listarArquivos(token: string, folderId: string): Promise<DriveFileInfo[]> {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`)
  const res = await fetchComTimeout(
    `${BASE}/files?q=${q}&fields=files(id,name,mimeType,modifiedTime)&pageSize=1000`,
    { headers: auth(token) },
  )
  if (!res.ok) throw new Error(`Drive listar: ${res.status}`)
  const data = (await res.json()) as { files?: DriveFileInfo[] }
  return data.files ?? []
}

export async function buscarPastaPorNome(token: string, nome: string): Promise<string | null> {
  const q = encodeURIComponent(`name = '${nome}' and mimeType = 'application/vnd.google-apps.folder' and trashed=false`)
  const res = await fetchComTimeout(`${BASE}/files?q=${q}&fields=files(id)&pageSize=1`, {
    headers: auth(token),
  })
  if (!res.ok) throw new Error(`Drive buscar pasta: ${res.status}`)
  const data = (await res.json()) as { files?: { id: string }[] }
  return data.files?.[0]?.id ?? null
}

export async function criarPastaDrive(token: string, nome: string, parentId?: string): Promise<string> {
  const res = await fetchComTimeout(`${BASE}/files`, {
    method: 'POST',
    headers: { ...auth(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: nome,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  })
  if (!res.ok) throw new Error(`Drive criar pasta: ${res.status}`)
  const data = (await res.json()) as { id: string }
  return data.id
}

export async function criarArquivoMultipart(
  token: string,
  nome: string,
  bytes: Uint8Array,
  parentId: string,
): Promise<string> {
  const boundary = `mydocs-${crypto.randomUUID()}`
  const enc = new TextEncoder()
  const meta = JSON.stringify({ name: nome, mimeType: 'application/octet-stream', parents: [parentId] })
  const pre = enc.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
      `--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`,
  )
  const pos = enc.encode(`\r\n--${boundary}--\r\n`)
  const corpo = new Uint8Array(pre.length + bytes.length + pos.length)
  corpo.set(pre, 0)
  corpo.set(bytes, pre.length)
  corpo.set(pos, pre.length + bytes.length)

  const res = await fetchComTimeout(`${BASE}/files?uploadType=multipart`, {
    method: 'POST',
    headers: { ...auth(token), 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: corpo.buffer,
  })
  if (!res.ok) throw new Error(`Drive upload: ${res.status}`)
  const data = (await res.json()) as { id: string }
  return data.id
}

export async function baixarArquivoComEtag(
  token: string,
  fileId: string,
): Promise<{ bytes: Uint8Array; etag?: string }> {
  const res = await fetchComTimeout(`${BASE}/files/${fileId}?alt=media`, { headers: auth(token) })
  if (!res.ok) throw new Error(`Drive baixar: ${res.status}`)
  const buf = await res.arrayBuffer()
  return { bytes: new Uint8Array(buf), etag: res.headers.get('ETag') ?? undefined }
}

export async function atualizarArquivo(
  token: string,
  fileId: string,
  bytes: Uint8Array,
  etag?: string,
): Promise<{ etag?: string }> {
  const headers: Record<string, string> = {
    ...auth(token),
    'Content-Type': 'application/octet-stream',
  }
  if (etag) headers['If-Match'] = etag
  const res = await fetchComTimeout(`${BASE}/files/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers,
    body: new Uint8Array(bytes).buffer,
  })
  if (!res.ok) throw new Error(`Drive atualizar: ${res.status}`)
  const data = (await res.json().catch(() => ({}))) as { etag?: string }
  return { etag: data.etag }
}

export async function excluirArquivo(token: string, fileId: string): Promise<void> {
  const res = await fetchComTimeout(`${BASE}/files/${fileId}`, {
    method: 'DELETE',
    headers: auth(token),
  })
  if (!res.ok) throw new Error(`Drive excluir: ${res.status}`)
}
