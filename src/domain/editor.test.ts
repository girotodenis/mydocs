import { describe, expect, it } from 'vitest'
import { nomeNota, tipoNotaDe } from './editor'

describe('editor', () => {
  it('detecta tipo de nota pela extensão', () => {
    expect(tipoNotaDe('nota.md')).toBe('markdown')
    expect(tipoNotaDe('nota.html')).toBe('html')
  })

  it('gera nome de arquivo seguro', () => {
    expect(nomeNota('Minha Nota', 'markdown')).toBe('Minha-Nota.md')
    expect(nomeNota('  ', 'html')).toBe('sem-titulo.html')
  })
})
