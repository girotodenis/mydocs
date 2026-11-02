import { describe, expect, it } from 'vitest'
import { descomprimirGzip, comprimirGzip } from './compression'

describe('compression', () => {
  it('comprime e descomprime gzip', async () => {
    const original = new TextEncoder().encode('conteúdo de teste repetido repetido repetido')
    const comprimido = await comprimirGzip(original)
    const restaurado = await descomprimirGzip(comprimido)
    expect(new TextDecoder().decode(restaurado)).toBe('conteúdo de teste repetido repetido repetido')
  })
})
