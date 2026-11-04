import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Item, Manifesto } from '@/domain/entities'
import type { ContextoVault } from './contexto'
import { adotarCofreDoDrive, conectarCofreAoServidor, ConflitoDeSenhaError } from './conexao'
import { cifrarManifesto } from './vault'
import { derivarChave, randomBytes } from '@/infrastructure/cripto/webCrypto'
import type { SessaoCripto } from '@/infrastructure/cripto/chaveSessao'
import * as drive from '@/infrastructure/drive/api'
import { lerItemCache, salvarManifestoCache } from '@/infrastructure/storage/cache'

vi.mock('@/infrastructure/drive/pasta', () => ({ garantirPastaApp: vi.fn(async () => 'pasta-1') }))
vi.mock('@/infrastructure/cripto/verificadorLocal', () => ({ gravarVerificadorComSalt: vi.fn() }))
vi.mock('@/infrastructure/storage/cache', () => ({
  lerItemCache: vi.fn(),
  salvarManifestoCache: vi.fn(),
}))
vi.mock('@/infrastructure/drive/api', () => ({
  listarArquivos: vi.fn(),
  baixarArquivoComEtag: vi.fn(),
  criarArquivoMultipart: vi.fn(),
  atualizarArquivo: vi.fn(),
  garantirPastaApp: vi.fn(),
}))

const ITER = 1000

function item(id: string, atualizadoEm = '2024-01-01T00:00:00.000Z'): Item {
  return {
    id,
    nome: `${id}.md`,
    mime: 'text/markdown',
    tamanho: 1,
    pastaId: null,
    blobId: id,
    iv: '',
    criadoEm: '2024-01-01T00:00:00.000Z',
    atualizadoEm,
  }
}

function manifesto(itens: Item[]): Manifesto {
  return { version: 1, pastas: [], itens }
}

async function sessaoDe(senha: string, salt = randomBytes(16)): Promise<SessaoCripto> {
  return { chave: await derivarChave(senha, salt, ITER), salt, iterations: ITER }
}

function contexto(sessao: SessaoCripto, local: Manifesto): ContextoVault {
  return {
    vaultId: 'cofre-local',
    arquivoId: '',
    folderId: '',
    vinculado: () => false,
    tokenProvider: async () => 'token',
    online: () => true,
    obterSessao: () => sessao,
    definirSessao: vi.fn(),
    lerManifesto: () => local,
    definirManifesto: vi.fn(),
  } as unknown as ContextoVault
}

function arquivoDrive(id: string, modifiedTime = '2024-01-01T00:00:00.000Z', bytes?: Uint8Array) {
  vi.mocked(drive.baixarArquivoComEtag).mockImplementation(async (_t, fileId) => {
    if (fileId !== id || !bytes) throw new Error('manifesto de outro cofre')
    return { bytes, etag: `"${id}"` }
  })
  return { id, name: 'mydocs.manifest', mimeType: 'application/octet-stream', modifiedTime }
}

beforeEach(() => {
  vi.mocked(drive.listarArquivos).mockReset()
  vi.mocked(drive.baixarArquivoComEtag).mockReset()
  vi.mocked(drive.criarArquivoMultipart).mockReset()
  vi.mocked(drive.atualizarArquivo).mockReset()
  vi.mocked(lerItemCache).mockReset()
  vi.mocked(salvarManifestoCache).mockReset()
})

describe('conectarCofreAoServidor', () => {
  it('traz itens do Drive e envia os que só existem localmente', async () => {
    const sessao = await sessaoDe('senha')
    const remoto = await cifrarManifesto(sessao, manifesto([{ ...item('remoto'), blobId: 'blob-remoto' }]))
    vi.mocked(drive.listarArquivos).mockResolvedValue([arquivoDrive('arq-remoto', '2024-02-01T00:00:00.000Z', remoto)])
    vi.mocked(drive.criarArquivoMultipart).mockResolvedValue('blob-enviado')
    vi.mocked(drive.atualizarArquivo).mockResolvedValue({ etag: '"novo"' })
    vi.mocked(lerItemCache).mockReturnValue(new Uint8Array([1, 2, 3]))

    const ctx = contexto(sessao, manifesto([item('local')]))
    const resultado = await conectarCofreAoServidor(ctx, 'mydocs_vault')

    expect(resultado.manifesto.itens.map((i) => i.id)).toEqual(['local', 'remoto'])
    expect(resultado.enviados).toBe(1)
    expect(resultado.recebidos).toBe(1)
    expect(resultado.arquivoId).toBe('arq-remoto')
    expect(drive.criarArquivoMultipart).toHaveBeenCalledWith('token', 'local', expect.any(Uint8Array), 'pasta-1')
    expect(resultado.manifesto.itens[0].blobId).toBe('blob-enviado')
    expect(drive.atualizarArquivo).toHaveBeenCalledWith('token', 'arq-remoto', expect.any(Uint8Array), '"arq-remoto"')
    expect(salvarManifestoCache).toHaveBeenCalledWith('cofre-local', expect.any(Uint8Array))
  })

  it('cria o manifesto quando a pasta ainda não tem cofre', async () => {
    const sessao = await sessaoDe('senha')
    vi.mocked(drive.listarArquivos).mockResolvedValue([])
    vi.mocked(lerItemCache).mockReturnValue(undefined)
    vi.mocked(drive.criarArquivoMultipart).mockResolvedValue('manifesto-novo')

    const ctx = contexto(sessao, manifesto([item('local')]))
    const resultado = await conectarCofreAoServidor(ctx, 'mydocs_vault')

    expect(drive.criarArquivoMultipart).toHaveBeenCalledWith(
      'token',
      'mydocs.manifest',
      expect.any(Uint8Array),
      'pasta-1',
    )
    expect(resultado.arquivoId).toBe('manifesto-novo')
    expect(resultado.enviados).toBe(0)
  })

  it('ignora manifestos de outros cofres e usa o que abre com a chave atual', async () => {
    const sessao = await sessaoDe('senha')
    const outroCofre = await cifrarManifesto(await sessaoDe('outra-senha'), manifesto([item('alheio')]))
    const nosso = await cifrarManifesto(sessao, manifesto([item('remoto')]))

    vi.mocked(drive.listarArquivos).mockResolvedValue([
      { id: 'antigo', name: 'mydocs.manifest', mimeType: 'x', modifiedTime: '2024-03-01T00:00:00.000Z' },
      { id: 'nosso', name: 'mydocs.manifest', mimeType: 'x', modifiedTime: '2024-02-01T00:00:00.000Z' },
    ])
    vi.mocked(drive.baixarArquivoComEtag).mockImplementation(async (_t, fileId) => {
      if (fileId === 'antigo') return { bytes: outroCofre, etag: '"antigo"' }
      return { bytes: nosso, etag: '"nosso"' }
    })
    vi.mocked(drive.atualizarArquivo).mockResolvedValue({ etag: '"x"' })
    vi.mocked(lerItemCache).mockReturnValue(undefined)

    const resultado = await conectarCofreAoServidor(contexto(sessao, manifesto([])), 'mydocs_vault')

    expect(resultado.arquivoId).toBe('nosso')
    expect(resultado.manifesto.itens.map((i) => i.id)).toEqual(['remoto'])
  })

  it('sinaliza conflito quando nenhum manifesto abre com a chave atual', async () => {
    const sessao = await sessaoDe('senha')
    const outroCofre = await cifrarManifesto(await sessaoDe('outra-senha'), manifesto([item('alheio')]))

    vi.mocked(drive.listarArquivos).mockResolvedValue([arquivoDrive('outro', '2024-01-01T00:00:00.000Z', outroCofre)])

    await expect(conectarCofreAoServidor(contexto(sessao, manifesto([])), 'mydocs_vault')).rejects.toBeInstanceOf(
      ConflitoDeSenhaError,
    )
  })
})

describe('adotarCofreDoDrive', () => {
  it('abre o cofre do Drive com a senha correta', async () => {
    const senha = 'senha-do-drive'
    const encriptado = await cifrarManifesto(await sessaoDe(senha), manifesto([item('do-drive')]))
    vi.mocked(drive.listarArquivos).mockResolvedValue([
      { id: 'outro', name: 'mydocs.manifest', mimeType: 'x', modifiedTime: '2024-03-01T00:00:00.000Z' },
      { id: 'alvo', name: 'mydocs.manifest', mimeType: 'x', modifiedTime: '2024-02-01T00:00:00.000Z' },
    ])
    vi.mocked(drive.baixarArquivoComEtag).mockImplementation(async (_t, fileId) => {
      if (fileId === 'alvo') return { bytes: encriptado, etag: '"alvo"' }
      throw new Error('outro cofre')
    })

    const ctx = contexto(await sessaoDe('outra'), manifesto([]))
    const resultado = await adotarCofreDoDrive(ctx, 'pasta-1', senha)

    expect(resultado.arquivoId).toBe('alvo')
    expect(resultado.manifesto.itens.map((i) => i.id)).toEqual(['do-drive'])
    expect(ctx.definirSessao).toHaveBeenCalled()
  })

  it('recusa senha incorreta', async () => {
    const encriptado = await cifrarManifesto(await sessaoDe('senha-do-drive'), manifesto([item('do-drive')]))
    vi.mocked(drive.listarArquivos).mockResolvedValue([arquivoDrive('alvo', '2024-02-01T00:00:00.000Z', encriptado)])

    await expect(adotarCofreDoDrive(contexto(await sessaoDe('outra'), manifesto([])), 'pasta-1', 'errada')).rejects.toThrow(
      /Senha incorreta/,
    )
  })
})
