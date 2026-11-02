import type { ItemId, PastaId } from './entities'

export function isItemId(v: unknown): v is ItemId {
  return typeof v === 'string' && v.length > 0
}

export function isPastaId(v: unknown): v is PastaId {
  return typeof v === 'string' && v.length > 0
}

export function gerarId(): string {
  return crypto.randomUUID()
}
