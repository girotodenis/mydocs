import type { Item, PastaVirtual } from '@/domain/entities'

export function normalizarItem(obj: unknown): Item {
  const o = (obj ?? {}) as Record<string, unknown>
  return {
    id: String(o.id ?? ''),
    nome: String(o.nome ?? ''),
    mime: String(o.mime ?? ''),
    tamanho: Number(o.tamanho ?? 0),
    pastaId: typeof o.pastaId === 'string' ? o.pastaId : null,
    blobId: String(o.blobId ?? ''),
    iv: String(o.iv ?? ''),
    criadoEm: String(o.criadoEm ?? ''),
    atualizadoEm: String(o.atualizadoEm ?? ''),
  }
}

export function normalizarPasta(obj: unknown): PastaVirtual {
  const o = (obj ?? {}) as Record<string, unknown>
  return {
    id: String(o.id ?? ''),
    nome: String(o.nome ?? ''),
    parentId: typeof o.parentId === 'string' ? o.parentId : null,
    criadoEm: String(o.criadoEm ?? ''),
  }
}
