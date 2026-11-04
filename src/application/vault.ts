import type { Manifesto } from '@/domain/entities'
import { gerarId } from '@/domain/itemId'
import { comprimirGzip, descomprimirGzip } from '@/infrastructure/compression'
import { cifrarComChaveComSalt, decifrarComChave } from '@/infrastructure/cripto/envelope'
import { ChaveNecessariaError } from '@/infrastructure/cripto/erros'
import type { SessaoCripto } from '@/infrastructure/cripto/chaveSessao'
import { derivarChave, randomBytes } from '@/infrastructure/cripto/webCrypto'
import { gravarVerificadorComSalt } from '@/infrastructure/cripto/verificadorLocal'
import { ITERACOES_KDF } from '@/infrastructure/cripto/constantes'
import { lerManifestoCache, salvarManifestoCache } from '@/infrastructure/storage/cache'
import { enfileirar } from '@/infrastructure/storage/outbox'
import { manifestoVazio, parseManifesto, serializarManifesto } from '@/infrastructure/vault/manifestoCodec'
import type { ContextoVault } from './contexto'

export interface CofreLocal {
  vaultId: string
  sessao: SessaoCripto
  manifesto: Manifesto
}

/**
 * Cria o cofre sem nenhuma dependência do Google: a chave é derivada da senha,
 * o verificador local é gravado e o manifesto vazio vai para o cache (IndexedDB).
 * O vínculo com o Drive é feito depois, sob demanda.
 */
export async function criarCofreLocal(senha: string): Promise<CofreLocal> {
  const vaultId = gerarId()
  const salt = randomBytes(16)
  const chave = await derivarChave(senha, salt, ITERACOES_KDF)
  const sessao: SessaoCripto = { chave, salt, iterations: ITERACOES_KDF }

  await gravarVerificadorComSalt(vaultId, senha, salt)
  const manifesto = manifestoVazio()
  await salvarManifestoCache(vaultId, await cifrarManifesto(sessao, manifesto))

  return { vaultId, sessao, manifesto }
}

export async function cifrarManifesto(sessao: SessaoCripto, manifesto: Manifesto): Promise<Uint8Array> {
  const comprimido = await comprimirGzip(serializarManifesto(manifesto))
  return cifrarComChaveComSalt(sessao.chave, sessao.salt, sessao.iterations, comprimido)
}

export async function decifrarManifesto(sessao: SessaoCripto, envelope: Uint8Array): Promise<Manifesto> {
  const comprimido = await decifrarComChave(sessao.chave, envelope)
  return parseManifesto(await descomprimirGzip(comprimido))
}

export async function carregarVault(ctx: ContextoVault): Promise<Manifesto> {
  if (!ctx.vinculado()) {
    throw new Error('Este cofre ainda não está sincronizado com o Google Drive.')
  }
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
  const manifesto = await decifrarManifesto(sessao, envelope)
  ctx.definirManifesto(manifesto)
  return manifesto
}

export async function persistirManifesto(ctx: ContextoVault, manifesto: Manifesto): Promise<void> {
  ctx.definirManifesto(manifesto)
  if (ctx.online() && ctx.vinculado()) {
    await ctx.vaultRepository.salvarManifesto(manifesto)
    return
  }
  // Offline (ou ainda sem vínculo com o Drive): persiste no cache para
  // sobreviver a reloads. Só entra na fila de sincronização quando o cofre já
  // está vinculado — o vínculo inicial envia tudo o que existe localmente.
  await ctx.vaultRepository.salvarManifestoLocal(manifesto)
  if (ctx.vinculado()) await enfileirar({ tipo: 'salvarManifesto' })
}
