import type { Manifesto, PastaId, PastaVirtual } from '@/domain/entities'
import { adicionarPasta, excluirPasta, moverPasta, renomearPasta } from '@/domain/arvore'
import { gerarId } from '@/domain/itemId'
import { nomeValido, normalizarNome } from '@/domain/nome'
import { clockDoNavegador } from '@/infrastructure/clock'
import type { ContextoVault } from './contexto'
import { persistirManifesto } from './vault'

function manifestoAtual(ctx: ContextoVault): Manifesto {
  const m = ctx.lerManifesto()
  if (!m) throw new Error('Cofre não carregado')
  return m
}

export async function criarPasta(ctx: ContextoVault, nome: string, parentId: PastaId | null): Promise<PastaVirtual> {
  const n = normalizarNome(nome)
  if (!nomeValido(n)) throw new Error('Nome inválido')
  const pasta: PastaVirtual = { id: gerarId(), nome: n, parentId, criadoEm: clockDoNavegador.agoraIso() }
  await persistirManifesto(ctx, adicionarPasta(manifestoAtual(ctx), pasta))
  return pasta
}

export async function renomearPastaUseCase(ctx: ContextoVault, id: PastaId, nome: string): Promise<void> {
  const n = normalizarNome(nome)
  if (!nomeValido(n)) throw new Error('Nome inválido')
  await persistirManifesto(ctx, renomearPasta(manifestoAtual(ctx), id, n))
}

export async function moverPastaUseCase(ctx: ContextoVault, id: PastaId, novoParentId: PastaId | null): Promise<void> {
  await persistirManifesto(ctx, moverPasta(manifestoAtual(ctx), id, novoParentId))
}

export async function excluirPastaUseCase(ctx: ContextoVault, id: PastaId): Promise<void> {
  await persistirManifesto(ctx, excluirPasta(manifestoAtual(ctx), id))
}
