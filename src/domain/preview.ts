import { mimeDeNome } from './mime'

export type TipoPreview = 'imagem' | 'texto' | 'markdown' | 'html' | 'video' | 'audio' | 'pdf' | 'outro'

export function classificarPreview(mime: string, nome: string): TipoPreview {
  const m = mime || mimeDeNome(nome)
  if (m.startsWith('image/')) return 'imagem'
  if (m.startsWith('video/')) return 'video'
  if (m.startsWith('audio/')) return 'audio'
  if (m === 'application/pdf') return 'pdf'
  if (m === 'text/markdown' || m === 'text/x-markdown') return 'markdown'
  if (m === 'text/html') return 'html'
  if (m.startsWith('text/') || m === 'application/json' || m === 'application/xml') return 'texto'
  return 'outro'
}
