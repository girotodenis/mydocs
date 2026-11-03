import { base64ParaBytes } from '@/infrastructure/cripto/webCrypto'
import { listarPendentes, limparFila, type Mutacao } from '@/infrastructure/storage/outbox'
import type { ContextoVault } from './contexto'

export async function sincronizar(ctx: ContextoVault): Promise<number> {
  const pendentes = listarPendentes()
  if (pendentes.length === 0) return 0

  for (const mut of pendentes) {
    await aplicarMutacao(ctx, mut)
  }

  await limparFila()
  return pendentes.length
}

async function aplicarMutacao(ctx: ContextoVault, mut: Mutacao): Promise<void> {
  if (mut.tipo === 'upload') {
    // Reenvia o blob e corrige o blobId do item no manifesto (durante o upload
    // offline o manifesto guarda um id provisório).
    const blobId = await ctx.itemStore.enviar(mut.itemId, base64ParaBytes(mut.envelopeB64), mut.mime)
    const m = ctx.lerManifesto()
    if (m) {
      const atualizado = {
        ...m,
        itens: m.itens.map((i) => (i.id === mut.itemId ? { ...i, blobId } : i)),
      }
      ctx.definirManifesto(atualizado)
      await ctx.vaultRepository.salvarManifestoLocal(atualizado)
    }
    return
  }
  if (mut.tipo === 'excluirBlob') {
    await ctx.itemStore.excluir(mut.blobId)
    return
  }
  // salvarManifesto: empurra o manifesto atual (em memória) para o Drive.
  const manifesto = ctx.lerManifesto()
  if (!manifesto) throw new Error('Manifesto não carregado para sincronizar')
  await ctx.vaultRepository.salvarManifesto(manifesto)
}

export { contarPendencias } from '@/infrastructure/storage/outbox'
