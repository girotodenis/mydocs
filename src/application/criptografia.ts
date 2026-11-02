import { derivarChave } from '@/infrastructure/cripto/webCrypto'
import { obterSaltVerificador, validarSenhaOffline } from '@/infrastructure/cripto/verificadorLocal'
import type { ContextoVault } from './contexto'

export type EstadoCripto = 'bloqueado' | 'desbloqueado'

export function estadoCripto(ctx: ContextoVault): EstadoCripto {
  return ctx.obterChave() ? 'desbloqueado' : 'bloqueado'
}

export async function desbloquear(ctx: ContextoVault, senha: string): Promise<boolean> {
  const params = obterSaltVerificador(ctx.vaultId)
  if (!params) return false

  const chave = await derivarChave(senha, params.salt, params.iterations)
  if (!(await validarSenhaOffline(ctx.vaultId, senha))) return false

  ctx.definirChave(chave)
  return true
}

export function bloquear(ctx: ContextoVault): void {
  ctx.limparChave()
}
