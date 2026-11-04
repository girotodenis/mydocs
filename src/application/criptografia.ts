import { abrirEnvelope } from '@/domain/envelope'
import { decifrarComSenha } from '@/infrastructure/cripto/envelope'
import { base64ParaBytes, derivarChave } from '@/infrastructure/cripto/webCrypto'
import {
  gravarVerificadorComSalt,
  obterSaltVerificador,
  validarSenhaOffline,
} from '@/infrastructure/cripto/verificadorLocal'
import { ITERACOES_KDF } from '@/infrastructure/cripto/constantes'
import * as drive from '@/infrastructure/drive/api'
import type { ContextoVault } from './contexto'

export type EstadoCripto = 'bloqueado' | 'desbloqueado'

export function estadoCripto(ctx: ContextoVault): EstadoCripto {
  return ctx.obterSessao() ? 'desbloqueado' : 'bloqueado'
}

export async function desbloquear(ctx: ContextoVault, senha: string): Promise<boolean> {
  // 1. Desbloqueio offline (verificador local deste dispositivo).
  const params = obterSaltVerificador(ctx.vaultId)
  if (params) {
    if (!(await validarSenhaOffline(ctx.vaultId, senha))) return false
    ctx.definirSessao({
      chave: await derivarChave(senha, params.salt, params.iterations),
      salt: params.salt,
      iterations: params.iterations,
    })
    return true
  }

  // 2. Primeiro desbloqueio neste dispositivo: valida contra o manifesto no
  // Drive (só é possível quando o cofre já está vinculado).
  if (!ctx.vinculado()) {
    throw new Error(
      'Este dispositivo ainda não conhece a senha deste cofre. Sincronize com o Google Drive para validá-la.',
    )
  }
  const token = await ctx.tokenProvider()
  const { bytes } = await drive.baixarArquivoComEtag(token, ctx.arquivoId)
  const aberto = abrirEnvelope(bytes)
  if (!aberto) throw new Error('Manifesto inválido')
  if (aberto.cabecalho.kdf === 'sessao' || !aberto.cabecalho.iterations) {
    throw new Error(
      'Este cofre usa um formato antigo. Abra-o no dispositivo onde foi criado e faça uma alteração para migrá-lo — ou crie um novo cofre.',
    )
  }
  await decifrarComSenha(senha, bytes) // lança se a senha estiver errada

  const salt = base64ParaBytes(aberto.cabecalho.salt || '')
  const iterations = aberto.cabecalho.iterations || ITERACOES_KDF
  ctx.definirSessao({ chave: await derivarChave(senha, salt, iterations), salt, iterations })
  await gravarVerificadorComSalt(ctx.vaultId, senha, salt)
  return true
}

export function bloquear(ctx: ContextoVault): void {
  ctx.limparSessao()
}
