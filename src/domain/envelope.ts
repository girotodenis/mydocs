export const ENVELOPE_MAGIC = 'MYDOCS-VAULT1'

export interface CabecalhoEnvelope {
  v: number
  kdf: 'PBKDF2-SHA256' | 'sessao'
  cipher: 'AES-256-GCM'
  iterations: number
  salt: string
  iv: string
}

export function montarEnvelope(cabecalho: CabecalhoEnvelope, ciphertext: Uint8Array): Uint8Array {
  const enc = new TextEncoder()
  const magic = enc.encode(ENVELOPE_MAGIC + '\n')
  const head = enc.encode(JSON.stringify(cabecalho) + '\n')
  const out = new Uint8Array(magic.length + head.length + ciphertext.length)
  out.set(magic, 0)
  out.set(head, magic.length)
  out.set(ciphertext, magic.length + head.length)
  return out
}

export interface EnvelopeAberto {
  cabecalho: CabecalhoEnvelope
  ciphertext: Uint8Array
}

export function abrirEnvelope(bytes: Uint8Array): EnvelopeAberto | null {
  const dec = new TextDecoder()
  const firstNewline = bytes.indexOf(10)
  if (firstNewline === -1) return null
  const magic = dec.decode(bytes.subarray(0, firstNewline))
  if (magic !== ENVELOPE_MAGIC) return null
  const secondNewline = bytes.indexOf(10, firstNewline + 1)
  if (secondNewline === -1) return null
  const headerText = dec.decode(bytes.subarray(firstNewline + 1, secondNewline))
  let cabecalho: CabecalhoEnvelope
  try {
    cabecalho = JSON.parse(headerText) as CabecalhoEnvelope
  } catch {
    return null
  }
  return { cabecalho, ciphertext: bytes.subarray(secondNewline + 1) }
}

export function temMagic(bytes: Uint8Array): boolean {
  const dec = new TextDecoder()
  const firstNewline = bytes.indexOf(10)
  if (firstNewline === -1) return false
  return dec.decode(bytes.subarray(0, firstNewline)) === ENVELOPE_MAGIC
}
