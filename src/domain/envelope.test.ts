import { describe, expect, it } from 'vitest'
import { abrirEnvelope, montarEnvelope, temMagic, type CabecalhoEnvelope } from './envelope'

const cabecalho: CabecalhoEnvelope = {
  v: 1,
  kdf: 'PBKDF2-SHA256',
  cipher: 'AES-256-GCM',
  iterations: 600_000,
  salt: 'c2FsdA==',
  iv: 'aXY=',
}

describe('envelope', () => {
  it('monta e reabre preservando o ciphertext', () => {
    const ciphertext = new TextEncoder().encode('conteúdo cifrado')
    const bytes = montarEnvelope(cabecalho, ciphertext)
    expect(temMagic(bytes)).toBe(true)
    const aberto = abrirEnvelope(bytes)
    expect(aberto).not.toBeNull()
    expect(aberto?.cabecalho.kdf).toBe('PBKDF2-SHA256')
    expect(new TextDecoder().decode(aberto?.ciphertext)).toBe('conteúdo cifrado')
  })

  it('não reconhece magic diferente', () => {
    expect(temMagic(new TextEncoder().encode('OUTRO-MAGIC\nx'))).toBe(false)
    expect(abrirEnvelope(new TextEncoder().encode('OUTRO-MAGIC\nx'))).toBeNull()
  })
})
