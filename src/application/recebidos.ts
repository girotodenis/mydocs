import type { PastaId } from '@/domain/entities'
import { mimeDeNome, MIME_PERMITIDO } from '@/domain/mime'
import { ChaveNecessariaError } from '@/infrastructure/cripto/erros'
import type { ContextoVault } from './contexto'
import { enviarArquivo } from './itens'

function mimeResolvido(mime: string, nome: string): string {
  const permitidos = MIME_PERMITIDO as readonly string[]
  if (permitidos.includes(mime)) return mime
  return mimeDeNome(nome)
}

export async function processarRecebidos(ctx: ContextoVault, pastaId: PastaId | null): Promise<number> {
  if (!ctx.obterSessao()?.chave) throw new ChaveNecessariaError()
  const recebidos = await ctx.shareTargetPort.lerRecebidos()
  let contagem = 0
  for (const arquivo of recebidos.files) {
    await enviarArquivo(ctx, {
      nome: arquivo.nome,
      mime: mimeResolvido(arquivo.mime, arquivo.nome),
      bytes: arquivo.bytes,
      pastaId,
    })
    contagem += 1
  }
  return contagem
}
