import type { Manifesto } from '@/domain/entities'
import { comprimirGzip } from '@/infrastructure/compression'
import { cifrarComChaveComSalt } from '@/infrastructure/cripto/envelope'
import type { SessaoCripto } from '@/infrastructure/cripto/chaveSessao'
import { derivarChave, randomBytes } from '@/infrastructure/cripto/webCrypto'
import { gravarVerificadorComSalt } from '@/infrastructure/cripto/verificadorLocal'
import { ITERACOES_KDF } from '@/infrastructure/cripto/constantes'
import { criarArquivoMultipart } from '@/infrastructure/drive/api'
import { garantirPastaApp } from '@/infrastructure/drive/pasta'
import { manifestoVazio, serializarManifesto } from '@/infrastructure/vault/manifestoCodec'
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

export async function persistirManifesto(ctx: ContextoVault, manifesto: Manifesto): Promise<void> {
  ctx.definirManifesto(manifesto)
  if (ctx.online()) {
    await ctx.vaultRepository.salvarManifesto(manifesto)
  }
}
