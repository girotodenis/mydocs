import type { Item, ItemId, Manifesto, PastaId, PastaVirtual } from './entities'

export function adicionarPasta(manifesto: Manifesto, pasta: PastaVirtual): Manifesto {
  return { ...manifesto, pastas: [...manifesto.pastas, pasta] }
}

export function renomearPasta(manifesto: Manifesto, id: PastaId, nome: string): Manifesto {
  return {
    ...manifesto,
    pastas: manifesto.pastas.map((p) => (p.id === id ? { ...p, nome } : p)),
  }
}

export function renomearItem(manifesto: Manifesto, id: ItemId, nome: string): Manifesto {
  return {
    ...manifesto,
    itens: manifesto.itens.map((i) => (i.id === id ? { ...i, nome } : i)),
  }
}

export function adicionarItem(manifesto: Manifesto, item: Item): Manifesto {
  return { ...manifesto, itens: [...manifesto.itens, item] }
}

export function moverItem(manifesto: Manifesto, id: ItemId, novaPastaId: PastaId | null): Manifesto {
  return {
    ...manifesto,
    itens: manifesto.itens.map((i) => (i.id === id ? { ...i, pastaId: novaPastaId } : i)),
  }
}

export function excluirItem(manifesto: Manifesto, id: ItemId): Manifesto {
  return { ...manifesto, itens: manifesto.itens.filter((i) => i.id !== id) }
}

function descendentes(manifesto: Manifesto, id: PastaId): Set<PastaId> {
  const resultado = new Set<PastaId>([id])
  let cresceu = true
  while (cresceu) {
    cresceu = false
    for (const p of manifesto.pastas) {
      if (p.parentId && resultado.has(p.parentId) && !resultado.has(p.id)) {
        resultado.add(p.id)
        cresceu = true
      }
    }
  }
  return resultado
}

export function moverPasta(manifesto: Manifesto, id: PastaId, novoParentId: PastaId | null): Manifesto {
  if (novoParentId === id) throw new Error('Uma pasta não pode ser movida para dentro dela mesma')
  if (novoParentId && descendentes(manifesto, id).has(novoParentId)) {
    throw new Error('Ciclo de pastas não permitido')
  }
  return {
    ...manifesto,
    pastas: manifesto.pastas.map((p) => (p.id === id ? { ...p, parentId: novoParentId } : p)),
  }
}

export function excluirPasta(manifesto: Manifesto, id: PastaId): Manifesto {
  const remover = descendentes(manifesto, id)
  return {
    ...manifesto,
    pastas: manifesto.pastas.filter((p) => !remover.has(p.id)),
    itens: manifesto.itens.filter((i) => !(i.pastaId && remover.has(i.pastaId))),
  }
}

export function subpastasDe(manifesto: Manifesto, pastaId: PastaId | null): PastaVirtual[] {
  return manifesto.pastas.filter((p) => p.parentId === pastaId)
}

export function itensDaPasta(manifesto: Manifesto, pastaId: PastaId | null): Item[] {
  return manifesto.itens.filter((i) => i.pastaId === pastaId)
}

export function resolverCaminho(manifesto: Manifesto, pastaId: PastaId | null): PastaVirtual[] {
  const caminho: PastaVirtual[] = []
  let atual = pastaId
  while (atual) {
    const pasta = manifesto.pastas.find((p) => p.id === atual)
    if (!pasta) break
    caminho.unshift(pasta)
    atual = pasta.parentId
  }
  return caminho
}

export function pastaExiste(manifesto: Manifesto, id: PastaId): boolean {
  return manifesto.pastas.some((p) => p.id === id)
}
