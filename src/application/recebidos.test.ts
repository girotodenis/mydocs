import { describe, expect, it, vi } from 'vitest'
import type { ContextoVault } from './contexto'
import { processarRecebidos } from './recebidos'
import { enviarArquivo } from './itens'
import { ChaveNecessariaError } from '@/infrastructure/cripto/erros'

vi.mock('./itens', () => ({ enviarArquivo: vi.fn().mockResolvedValue(undefined) }))

describe('processarRecebidos', () => {
  it('preserva o link pendente até o cofre ser desbloqueado', async () => {
    const bytes = new TextEncoder().encode('https://example.com')
    const lerRecebidos = vi.fn().mockResolvedValue({
      files: [{ nome: 'link.txt', mime: 'text/plain', bytes }],
    })
    const obterSessao = vi.fn<ContextoVault['obterSessao']>().mockReturnValue(undefined)
    const contexto = {
      obterSessao,
      shareTargetPort: { lerRecebidos },
    } as unknown as ContextoVault

    await expect(processarRecebidos(contexto, null)).rejects.toBeInstanceOf(ChaveNecessariaError)
    expect(lerRecebidos).not.toHaveBeenCalled()
    expect(enviarArquivo).not.toHaveBeenCalled()

    obterSessao.mockReturnValue({ chave: {} as CryptoKey } as ReturnType<ContextoVault['obterSessao']>)
    await expect(processarRecebidos(contexto, null)).resolves.toBe(1)
    expect(lerRecebidos).toHaveBeenCalledTimes(1)
    expect(enviarArquivo).toHaveBeenCalledWith(contexto, {
      nome: 'link.txt', mime: 'text/plain', bytes, pastaId: null,
    })
  })
})