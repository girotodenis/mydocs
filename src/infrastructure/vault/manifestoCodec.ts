import type { Manifesto } from '@/domain/entities'
import { normalizarItem, normalizarPasta } from './itemCodec'

export const MANIFESTO_VERSION = 1

export function manifestoVazio(): Manifesto {
  return { version: MANIFESTO_VERSION, pastas: [], itens: [] }
}

export function serializarManifesto(manifesto: Manifesto): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(manifesto))
}

export function parseManifesto(bytes: Uint8Array): Manifesto {
  return normalizarManifesto(JSON.parse(new TextDecoder().decode(bytes)))
}

export function normalizarManifesto(obj: unknown): Manifesto {
  if (!obj || typeof obj !== 'object') return manifestoVazio()
  const o = obj as Partial<Manifesto>
  return {
    version: typeof o.version === 'number' ? o.version : MANIFESTO_VERSION,
    pastas: Array.isArray(o.pastas) ? o.pastas.map(normalizarPasta) : [],
    itens: Array.isArray(o.itens) ? o.itens.map(normalizarItem) : [],
  }
}
