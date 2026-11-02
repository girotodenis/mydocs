export type TipoNota = 'markdown' | 'html'

export function tipoNotaDe(nome: string): TipoNota {
  const ext = nome.slice(nome.lastIndexOf('.') + 1).toLowerCase()
  return ext === 'html' || ext === 'htm' ? 'html' : 'markdown'
}

export function nomeNota(titulo: string, tipo: TipoNota): string {
  const base =
    titulo
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[\\/:*?"<>|]/g, '')
      .slice(0, 80) || 'sem-titulo'
  return `${base}.${tipo === 'html' ? 'html' : 'md'}`
}
