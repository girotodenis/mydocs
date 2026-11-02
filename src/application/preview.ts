import type { Item } from '@/domain/entities'
import { classificarPreview, type TipoPreview } from '@/domain/preview'
import { descomprimirGzip } from '@/infrastructure/compression'
import { decifrarComChave } from '@/infrastructure/cripto/envelope'
import { ChaveNecessariaError } from '@/infrastructure/cripto/erros'
import { lerItemCache, salvarItemCache } from '@/infrastructure/storage/cache'
import type { ContextoVault } from './contexto'

export interface ItemAberto {
  tipo: TipoPreview
  bytes: Uint8Array
}

export async function abrirItem(ctx: ContextoVault, item: Item): Promise<ItemAberto> {
  const chave = ctx.obterSessao()?.chave
  if (!chave) throw new ChaveNecessariaError()

  let envelope = lerItemCache(ctx.vaultId, item.id)
  if (!envelope) {
    envelope = await ctx.itemStore.baixar(item.blobId)
    await salvarItemCache(ctx.vaultId, item.id, envelope)
  }

  const comprimido = await decifrarComChave(chave, envelope)
  const bytes = await descomprimirGzip(comprimido)
  return { tipo: classificarPreview(item.mime, item.nome), bytes }
}
