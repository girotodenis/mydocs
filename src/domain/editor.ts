export type TipoNota = 'markdown' | 'html' | 'text'

export function tipoNotaDe(nome: string): TipoNota {
  const ext = nome.slice(nome.lastIndexOf('.') + 1).toLowerCase()
  if (ext === 'html' || ext === 'htm') return 'html'
  if (ext === 'md' || ext === 'markdown') return 'markdown'
  return 'text'
}

export function nomeNota(titulo: string, tipo: TipoNota): string {
  const base =
    titulo
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[\\/:*?"<>|]/g, '')
      .slice(0, 80) || 'sem-titulo'
  const ext = tipo === 'html' ? 'html' : tipo === 'text' ? 'txt' : 'md'
  return `${base}.${ext}`
}
