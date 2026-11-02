import { describe, expect, it } from 'vitest'
import { cifrarComSenha, decifrarComSenha } from './envelope'

describe('cripto/envelope', () => {
  it('cifra e decifra com a senha correta', async () => {
    const original = new TextEncoder().encode('manifesto secreto')
    const cifrado = await cifrarComSenha('senha-forte', original)
    const claro = await decifrarComSenha('senha-forte', cifrado)
    expect(new TextDecoder().decode(claro)).toBe('manifesto secreto')
  })

  it('falha com senha errada', async () => {
    const cifrado = await cifrarComSenha('senha-forte', new TextEncoder().encode('dados'))
    await expect(decifrarComSenha('senha-errada', cifrado)).rejects.toThrow()
  })
})
