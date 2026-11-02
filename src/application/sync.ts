import { base64ParaBytes } from '@/infrastructure/cripto/webCrypto'
import { listarPendentes, limparFila, type Mutacao } from '@/infrastructure/storage/outbox'
import type { ContextoVault } from './contexto'

export async function sincronizar(ctx: ContextoVault): Promise<number> {
  const pendentes = listarPendentes()
  if (pendentes.length === 0) return 0

  let alterouManifesto = false
  for (const mut of pendentes) {
    await aplicarMutacao(ctx, mut)
    alterouManifesto = true
  }

  if (alterouManifesto && ctx.lerManifesto()) {
    await ctx.vaultRepository.salvarManifesto(ctx.lerManifesto()!)
  }

  await limparFila()
  return pendentes.length
}

async function aplicarMutacao(ctx: ContextoVault, mut: Mutacao): Promise<void> {
  if (mut.tipo === 'upload') {
    await ctx.itemStore.enviar(mut.itemId, base64ParaBytes(mut.envelopeB64), mut.mime)
    return
  }
  await ctx.itemStore.excluir(mut.blobId)
}

export { contarPendencias } from '@/infrastructure/storage/outbox'
