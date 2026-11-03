import type { Manifesto } from '@/domain/entities'
import { comprimirGzip, descomprimirGzip } from '@/infrastructure/compression'
import { cifrarComChaveComSalt, decifrarComChave } from '@/infrastructure/cripto/envelope'
import { ChaveNecessariaError } from '@/infrastructure/cripto/erros'
import type { SessaoCripto } from '@/infrastructure/cripto/chaveSessao'
import { derivarChave, randomBytes } from '@/infrastructure/cripto/webCrypto'
import { gravarVerificadorComSalt } from '@/infrastructure/cripto/verificadorLocal'
import { ITERACOES_KDF } from '@/infrastructure/cripto/constantes'
import { criarArquivoMultipart } from '@/infrastructure/drive/api'
import { garantirPastaApp } from '@/infrastructure/drive/pasta'
import { lerManifestoCache } from '@/infrastructure/storage/cache'
import { enfileirar } from '@/infrastructure/storage/outbox'
import { manifestoVazio, parseManifesto, serializarManifesto } from '@/infrastructure/vault/manifestoCodec'
import type { ContextoVault } from './contexto'

export interface NovoCofre {
  vaultId: string
  folderId: string
  sessao: SessaoCripto
}

export async function criarNovoCofre(token: string, senha: string, folderNome: string): Promise<NovoCofre> {
  const folderId = await garantirPastaApp(token, folderNome)
  const salt = randomBytes(16)
  const chave = await derivarChave(senha, salt, ITERACOES_KDF)

  const manifesto = manifestoVazio()
  const claro = serializarManifesto(manifesto)
  const comprimido = await comprimirGzip(claro)
  const envelope = await cifrarComChaveComSalt(chave, salt, ITERACOES_KDF, comprimido)
  const vaultId = await criarArquivoMultipart(token, 'mydocs.manifest', envelope, folderId)

  await gravarVerificadorComSalt(vaultId, senha, salt)
  return { vaultId, folderId, sessao: { chave, salt, iterations: ITERACOES_KDF } }
}

export async function carregarVault(ctx: ContextoVault): Promise<Manifesto> {
  const manifesto = await ctx.vaultRepository.carregarManifesto()
  ctx.definirManifesto(manifesto)
  return manifesto
}

/**
 * Abre o cofre offline: decifra o manifesto que está no cache local (IndexedDB)
 * usando a chave de sessão já derivada. Lança se não houver cache (primeiro
 * acesso neste dispositivo) ou se a chave não estiver disponível.
 */
export async function carregarVaultDoCache(ctx: ContextoVault): Promise<Manifesto> {
  const sessao = ctx.obterSessao()
  if (!sessao) throw new ChaveNecessariaError()
  const envelope = lerManifestoCache(ctx.vaultId)
  if (!envelope) throw new Error('Este cofre ainda não foi baixado neste dispositivo. Conecte-se para abri-lo.')
  const comprimido = await decifrarComChave(sessao.chave, envelope)
  const claro = await descomprimirGzip(comprimido)
  const manifesto = parseManifesto(claro)
  ctx.definirManifesto(manifesto)
  return manifesto
}

export async function persistirManifesto(ctx: ContextoVault, manifesto: Manifesto): Promise<void> {
  ctx.definirManifesto(manifesto)
  if (ctx.online()) {
    await ctx.vaultRepository.salvarManifesto(manifesto)
    return
  }
  // Offline: persiste no cache para sobreviver a reloads e enfileira a
  // gravação no Drive para sincronizar ao reconectar.
  await ctx.vaultRepository.salvarManifestoLocal(manifesto)
  await enfileirar({ tipo: 'salvarManifesto' })
}
