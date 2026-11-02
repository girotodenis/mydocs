export function nomeValido(nome: string): boolean {
  const t = nome.trim()
  return t.length > 0 && t.length <= 255 && !/[\\/]/.test(t)
}

export function normalizarNome(nome: string): string {
  return nome.trim()
}
