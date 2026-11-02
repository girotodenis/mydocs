import type { PastaId } from '@/domain/entities'
import { nomeNota, tipoNotaDe } from '@/domain/editor'
import type { ContextoVault } from './contexto'
import { enviarArquivo } from './itens'

export async function salvarNota(
  ctx: ContextoVault,
  titulo: string,
  conteudo: string,
  tipo: 'markdown' | 'html',
  pastaId: PastaId | null,
): Promise<void> {
  const nome = nomeNota(titulo, tipo)
  const mime = tipo === 'html' ? 'text/html' : 'text/markdown'
  await enviarArquivo(ctx, { nome, mime, bytes: new TextEncoder().encode(conteudo), pastaId })
}

export { nomeNota, tipoNotaDe }
