import { describe, expect, it } from 'vitest'
import { classificarPreview } from './preview'

describe('classificarPreview', () => {
  it('classifica imagens, texto, markdown, html, mídia e pdf', () => {
    expect(classificarPreview('image/png', 'a.png')).toBe('imagem')
    expect(classificarPreview('text/plain', 'a.txt')).toBe('texto')
    expect(classificarPreview('text/markdown', 'a.md')).toBe('markdown')
    expect(classificarPreview('text/html', 'a.html')).toBe('html')
    expect(classificarPreview('video/mp4', 'a.mp4')).toBe('video')
    expect(classificarPreview('audio/mpeg', 'a.mp3')).toBe('audio')
    expect(classificarPreview('application/pdf', 'a.pdf')).toBe('pdf')
    expect(classificarPreview('application/zip', 'a.zip')).toBe('outro')
  })

  it('infere a partir do nome quando o mime é vazio', () => {
    expect(classificarPreview('', 'a.jpg')).toBe('imagem')
    expect(classificarPreview('', 'a.md')).toBe('markdown')
  })
})
