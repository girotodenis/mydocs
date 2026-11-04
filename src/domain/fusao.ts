import type { Item, Manifesto, PastaVirtual } from './entities'

function maisRecente(a: Item, b: Item): Item {
  return a.atualizadoEm >= b.atualizadoEm ? a : b
}

function mesclarItens(local: Item[], remoto: Item[]): Item[] {
  const porId = new Map<string, Item>()
  for (const item of local) porId.set(item.id, item)
  for (const item of remoto) {
    const existente = porId.get(item.id)
    porId.set(item.id, existente ? maisRecente(existente, item) : item)
  }
  // Mantém a ordem local (o usuário reconhece o que já via) e anexa o que só
  // existe no remoto.
  const ordem = [...local.map((i) => i.id), ...remoto.filter((i) => !local.some((l) => l.id === i.id)).map((i) => i.id)]
  return ordem.map((id) => porId.get(id)!).filter(Boolean)
}

function mesclarPastas(local: PastaVirtual[], remoto: PastaVirtual[]): PastaVirtual[] {
  const porId = new Map<string, PastaVirtual>()
  for (const pasta of local) porId.set(pasta.id, pasta)
  for (const pasta of remoto) if (!porId.has(pasta.id)) porId.set(pasta.id, pasta)
  const ordem = [...local.map((p) => p.id), ...remoto.filter((p) => !local.some((l) => l.id === p.id)).map((p) => p.id)]
  return ordem.map((id) => porId.get(id)!).filter(Boolean)
}

/**
 * União de dois manifestos (local e remoto). Em conflito de item vence o
 * registro com `atualizadoEm` mais recente; em conflito de pasta vence o local.
 * Remoções não são propagadas pela fusão — ela serve para vincular um cofre
 * local a um cofre já existente no Drive, não para resolver exclusões.
 */
export function mesclarManifestos(local: Manifesto, remoto: Manifesto): Manifesto {
  return {
    version: local.version,
    pastas: mesclarPastas(local.pastas, remoto.pastas),
    itens: mesclarItens(local.itens, remoto.itens),
  }
}
