const chaves = new Map<string, CryptoKey>()

export function guardarChave(id: string, chave: CryptoKey): void {
  chaves.set(id, chave)
}

export function obterChave(id: string): CryptoKey | undefined {
  return chaves.get(id)
}

export function removerChave(id: string): void {
  chaves.delete(id)
}

export function limparChaves(): void {
  chaves.clear()
}

export function temChave(id: string): boolean {
  return chaves.has(id)
}
