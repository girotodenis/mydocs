export const MIME_PERMITIDO = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'text/plain',
  'text/markdown',
  'text/html',
  'text/csv',
  'application/json',
  'application/xml',
] as const

export function mimeDeNome(nome: string): string {
  const ext = nome.slice(nome.lastIndexOf('.') + 1).toLowerCase()
  switch (ext) {
    case 'png':
      return 'image/png'
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'gif':
      return 'image/gif'
    case 'webp':
      return 'image/webp'
    case 'svg':
      return 'image/svg+xml'
    case 'txt':
    case 'log':
      return 'text/plain'
    case 'md':
    case 'markdown':
      return 'text/markdown'
    case 'html':
    case 'htm':
      return 'text/html'
    case 'csv':
      return 'text/csv'
    case 'json':
      return 'application/json'
    case 'xml':
      return 'application/xml'
    default:
      return 'application/octet-stream'
  }
}
