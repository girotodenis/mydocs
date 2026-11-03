const encoder = new TextEncoder()

function asBufferSource(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

export async function derivarChave(
  senha: string,
  salt: Uint8Array,
  iterations: number,
  extractable = false,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    asBufferSource(encoder.encode(senha)),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: asBufferSource(salt), iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    extractable,
    ['encrypt', 'decrypt'],
  )
}

export async function cifrarGCM(
  chave: CryptoKey,
  iv: Uint8Array,
  plaintext: Uint8Array,
  aad: Uint8Array,
): Promise<Uint8Array> {
  const buf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: asBufferSource(iv), additionalData: asBufferSource(aad) },
    chave,
    asBufferSource(plaintext),
  )
  return new Uint8Array(buf)
}

export async function decifrarGCM(
  chave: CryptoKey,
  iv: Uint8Array,
  ciphertext: Uint8Array,
  aad: Uint8Array,
): Promise<Uint8Array> {
  const buf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: asBufferSource(iv), additionalData: asBufferSource(aad) },
    chave,
    asBufferSource(ciphertext),
  )
  return new Uint8Array(buf)
}

export function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n)
  crypto.getRandomValues(out)
  return out
}

export function bytesBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000
  const partes: string[] = []
  for (let i = 0; i < bytes.length; i += CHUNK) {
    partes.push(String.fromCharCode(...Array.from(bytes.subarray(i, i + CHUNK))))
  }
  return btoa(partes.join(''))
}

export function base64ParaBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export async function exportarChaveRaw(chave: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.exportKey('raw', chave))
}

export async function importarChaveRaw(bytes: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', asBufferSource(bytes), { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ])
}
