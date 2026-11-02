import { describe, expect, it } from 'vitest'
import {
  adicionarItem,
  adicionarPasta,
  excluirPasta,
  itensDaPasta,
  moverItem,
  moverPasta,
  resolverCaminho,
  subpastasDe,
} from './arvore'
import type { Item, Manifesto, PastaVirtual } from './entities'

const AGORA = '2026-01-01T00:00:00.000Z'

function pasta(id: string, nome: string, parentId: string | null = null): PastaVirtual {
  return { id, nome, parentId, criadoEm: AGORA }
}

function item(id: string, pastaId: string | null = null): Item {
  return {
    id,
    nome: `${id}.txt`,
    mime: 'text/plain',
    tamanho: 10,
    pastaId,
    blobId: `blob-${id}`,
    iv: 'iv',
    criadoEm: AGORA,
    atualizadoEm: AGORA,
  }
}

function vazio(): Manifesto {
  return { version: 1, pastas: [], itens: [] }
}

describe('arvore', () => {
  it('move item entre pastas', () => {
    let m = adicionarPasta(vazio(), pasta('a', 'A'))
    m = adicionarItem(m, item('i1', null))
    m = moverItem(m, 'i1', 'a')
    expect(itensDaPasta(m, 'a')).toHaveLength(1)
    expect(itensDaPasta(m, null)).toHaveLength(0)
  })

  it('impede mover pasta para dentro de um descendente', () => {
    let m = adicionarPasta(vazio(), pasta('a', 'A'))
    m = adicionarPasta(m, pasta('b', 'B', 'a'))
    expect(() => moverPasta(m, 'a', 'b')).toThrow('Ciclo de pastas não permitido')
  })

  it('excluir pasta remove descendentes e seus itens', () => {
    let m = adicionarPasta(vazio(), pasta('a', 'A'))
    m = adicionarPasta(m, pasta('b', 'B', 'a'))
    m = adicionarItem(m, item('i1', 'b'))
    m = excluirPasta(m, 'a')
    expect(m.pastas).toHaveLength(0)
    expect(m.itens).toHaveLength(0)
  })

  it('resolve caminho e lista subpastas', () => {
    let m = adicionarPasta(vazio(), pasta('a', 'A'))
    m = adicionarPasta(m, pasta('b', 'B', 'a'))
    const caminho = resolverCaminho(m, 'b')
    expect(caminho.map((p) => p.id)).toEqual(['a', 'b'])
    expect(subpastasDe(m, 'a').map((p) => p.id)).toEqual(['b'])
  })
})
