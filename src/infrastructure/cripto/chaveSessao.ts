export interface SessaoCripto {
  chave: CryptoKey
  salt: Uint8Array
  iterations: number
}

const sessoes = new Map<string, SessaoCripto>()

export function guardarSessao(id: string, sessao: SessaoCripto): void {
  sessoes.set(id, sessao)
}

export function obterSessao(id: string): SessaoCripto | undefined {
  return sessoes.get(id)
}

export function removerSessao(id: string): void {
  sessoes.delete(id)
}

export function limparSessoes(): void {
  sessoes.clear()
}
