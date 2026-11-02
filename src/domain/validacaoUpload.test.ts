import { describe, expect, it } from 'vitest'
import { validarUpload } from './validacaoUpload'

describe('validarUpload', () => {
  it('aceita arquivo válido', () => {
    expect(validarUpload('foto.png', 1000, 'image/png')).toEqual({ ok: true })
  })

  it('recusa arquivo acima do limite', () => {
    const r = validarUpload('foto.png', 5 * 1024 * 1024 + 1, 'image/png')
    expect(r.ok).toBe(false)
    expect(r.motivo).toContain('5 MB')
  })

  it('recusa mime não suportado', () => {
    const r = validarUpload('arquivo.zip', 1000, 'application/zip')
    expect(r.ok).toBe(false)
  })

  it('recusa nome inválido', () => {
    expect(validarUpload('a/b.txt', 10, 'text/plain').ok).toBe(false)
  })
})
