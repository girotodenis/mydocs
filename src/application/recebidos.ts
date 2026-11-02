import type { PastaId } from '@/domain/entities'
import type { ContextoVault } from './contexto'
import { enviarArquivo } from './itens'

export async function processarRecebidos(ctx: ContextoVault, pastaId: PastaId | null): Promise<number> {
  const recebidos = await ctx.shareTargetPort.lerRecebidos()
  let contagem = 0
  for (const arquivo of recebidos.files) {
    await enviarArquivo(ctx, {
      nome: arquivo.nome,
      mime: arquivo.mime,
      bytes: arquivo.bytes,
      pastaId,
    })
    contagem += 1
  }
  return contagem
}
