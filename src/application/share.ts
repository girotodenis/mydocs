import type { Item } from '@/domain/entities'
import type { ContextoVault } from './contexto'
import { abrirItem } from './preview'

export async function compartilharItem(ctx: ContextoVault, item: Item): Promise<void> {
  const { bytes } = await abrirItem(ctx, item)
  await ctx.sharePort.compartilharArquivo(item.nome, item.mime, bytes)
}
