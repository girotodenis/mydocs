import { describe, expect, it } from 'vitest'
import type { Item, Manifesto, PastaVirtual } from './entities'
import { mesclarManifestos } from './fusao'

function item(id: string, atualizadoEm: string, extra: Partial<Item> = {}): Item {
  return {
    id,
    nome: `${id}.txt`,
    mime: 'text/plain',
    tamanho: 1,
    pastaId: null,
    blobId: id,
    iv: '',
    criadoEm: '2024-01-01T00:00:00.000Z',
    atualizadoEm,
    ...extra,
  }
}

function manifesto(pastas: PastaVirtual[], itens: Item[]): Manifesto {
  return { version: 1, pastas, itens }
}

describe('mesclarManifestos', () => {
  it('mantém os itens locais e anexa os que só existem no remoto', () => {
    const local = manifesto([], [item('a', '2024-01-01T00:00:00.000Z')])
    const remoto = manifesto([], [item('b', '2024-01-01T00:00:00.000Z')])

    const r = mesclarManifestos(local, remoto)

    expect(r.itens.map((i) => i.id)).toEqual(['a', 'b'])
  })

  it('em conflito de item vence o mais recente', () => {
    const local = manifesto([], [item('a', '2024-05-01T00:00:00.000Z', { nome: 'local.txt' })])
    const remoto = manifesto([], [item('a', '2024-06-01T00:00:00.000Z', { nome: 'remoto.txt' })])

    expect(mesclarManifestos(local, remoto).itens[0].nome).toBe('remoto.txt')
    expect(mesclarManifestos(remoto, local).itens[0].nome).toBe('remoto.txt')
  })

  it('preserva a ordem local e não duplica pastas', () => {
    const local = manifesto([{ id: 'p1', nome: 'Local', parentId: null, criadoEm: 'x' }], [])
    const remoto = manifesto(
      [
        { id: 'p2', nome: 'Remota', parentId: null, criadoEm: 'x' },
        { id: 'p1', nome: 'Outro nome', parentId: null, criadoEm: 'x' },
      ],
      [],
    )

    const r = mesclarManifestos(local, remoto)

    expect(r.pastas.map((p) => p.id)).toEqual(['p1', 'p2'])
    expect(r.pastas[0].nome).toBe('Local')
  })
})
