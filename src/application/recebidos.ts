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

function mensagem(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export async function processarRecebidos(
  ctx: ContextoVault,
  pastaId: PastaId | null,
  onLog?: (msg: string) => void,
): Promise<number> {
  if (!ctx.obterSessao()?.chave) throw new ChaveNecessariaError()
  onLog?.('Lendo caixa de entrada…')
  const recebidos = await ctx.shareTargetPort.lerRecebidos()
  if (recebidos.debug && recebidos.debug.length > 0) {
    onLog?.('O que o service worker recebeu:')
    for (const linha of recebidos.debug) onLog?.(`  [SW] ${linha}`)
  }
  onLog?.(`${recebidos.files.length} arquivo(s) encontrado(s)`)
  let contagem = 0
  for (const arquivo of recebidos.files) {
    const mime = mimeResolvido(arquivo.mime, arquivo.nome)
    onLog?.(`→ Importando "${arquivo.nome}" (${mime}, ${arquivo.bytes.byteLength} bytes)…`)
    try {
      await enviarArquivo(ctx, {
        nome: arquivo.nome,
        mime,
        bytes: arquivo.bytes,
        pastaId,
      })
      contagem += 1
      onLog?.(`  ✓ "${arquivo.nome}" importado`)
    } catch (e) {
      onLog?.(`  ✗ "${arquivo.nome}": ${mensagem(e)}`)
    }
  }
  return contagem
}
