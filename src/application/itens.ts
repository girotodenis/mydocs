import type { Item, ItemId, Manifesto, PastaId } from '@/domain/entities'
import { adicionarItem, excluirItem, moverItem, renomearItem } from '@/domain/arvore'
import { gerarId } from '@/domain/itemId'
import { nomeValido, normalizarNome } from '@/domain/nome'
import { validarUpload } from '@/domain/validacaoUpload'
import { MAX_FILE_BYTES } from '@/infrastructure/config'
import { comprimirGzip } from '@/infrastructure/compression'
import { cifrarComChave } from '@/infrastructure/cripto/envelope'
import { ChaveNecessariaError } from '@/infrastructure/cripto/erros'
import { clockDoNavegador } from '@/infrastructure/clock'
import { salvarItemCache } from '@/infrastructure/storage/cache'
import type { ContextoVault } from './contexto'
import { persistirManifesto } from './vault'

function manifestoAtual(ctx: ContextoVault): Manifesto {
  const m = ctx.lerManifesto()
  if (!m) throw new Error('Cofre não carregado')
  return m
}

export interface ArquivoEntrada {
  nome: string
  mime: string
  bytes: Uint8Array
  pastaId: PastaId | null
}

export async function enviarArquivo(ctx: ContextoVault, arquivo: ArquivoEntrada): Promise<Item> {
  const v = validarUpload(arquivo.nome, arquivo.bytes.byteLength, arquivo.mime, MAX_FILE_BYTES)
  if (!v.ok) throw new Error(v.motivo)

  const chave = ctx.obterChave()
  if (!chave) throw new ChaveNecessariaError()

  const itemId = gerarId()
  const comprimido = await comprimirGzip(arquivo.bytes)
  const envelope = await cifrarComChave(chave, comprimido)
  const blobId = await ctx.itemStore.enviar(itemId, envelope, arquivo.mime)
  await salvarItemCache(ctx.vaultId, itemId, envelope)

  const agora = clockDoNavegador.agoraIso()
  const item: Item = {
    id: itemId,
    nome: arquivo.nome,
    mime: arquivo.mime,
    tamanho: arquivo.bytes.byteLength,
    pastaId: arquivo.pastaId,
    blobId,
    iv: '',
    criadoEm: agora,
    atualizadoEm: agora,
  }
  await persistirManifesto(ctx, adicionarItem(manifestoAtual(ctx), item))
  return item
}

export async function renomearItemUseCase(ctx: ContextoVault, id: ItemId, nome: string): Promise<void> {
  const n = normalizarNome(nome)
  if (!nomeValido(n)) throw new Error('Nome inválido')
  await persistirManifesto(ctx, renomearItem(manifestoAtual(ctx), id, n))
}

export async function moverItemUseCase(ctx: ContextoVault, id: ItemId, novaPastaId: PastaId | null): Promise<void> {
  await persistirManifesto(ctx, moverItem(manifestoAtual(ctx), id, novaPastaId))
}

export async function excluirItemUseCase(ctx: ContextoVault, id: ItemId): Promise<void> {
  const m = manifestoAtual(ctx)
  const item = m.itens.find((i) => i.id === id)
  await persistirManifesto(ctx, excluirItem(m, id))
  if (item) {
    await ctx.itemStore.excluir(item.blobId)
  }
}

export async function atualizarItemConteudo(
  ctx: ContextoVault,
  id: ItemId,
  nome: string,
  mime: string,
  bytes: Uint8Array,
): Promise<void> {
  const chave = ctx.obterChave()
  if (!chave) throw new ChaveNecessariaError()

  const m = manifestoAtual(ctx)
  const item = m.itens.find((i) => i.id === id)
  if (!item) throw new Error('Item não encontrado')

  const comprimido = await comprimirGzip(bytes)
  const envelope = await cifrarComChave(chave, comprimido)
  const blobId = await ctx.itemStore.enviar(id, envelope, mime)
  await salvarItemCache(ctx.vaultId, id, envelope)
  if (item.blobId) await ctx.itemStore.excluir(item.blobId)

  const atualizado: Item = { ...item, nome, mime, tamanho: bytes.byteLength, blobId, atualizadoEm: clockDoNavegador.agoraIso() }
  await persistirManifesto(ctx, { ...m, itens: m.itens.map((i) => (i.id === id ? atualizado : i)) })
}
