import { abrirEnvelope } from '@/domain/envelope'
import { decifrarComSenha } from '@/infrastructure/cripto/envelope'
import { base64ParaBytes, derivarChave, exportarChaveRaw, importarChaveRaw } from '@/infrastructure/cripto/webCrypto'
import {
  configurarBiometria,
  desbloquearComBiometria as obterChaveComBiometria,
} from '@/infrastructure/cripto/biometria'
import type { SessaoCripto } from '@/infrastructure/cripto/chaveSessao'
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
    const chave = await derivarChave(senha, params.salt, params.iterations, true)
    if (await validarSenhaOffline(ctx.vaultId, senha)) {
      ctx.definirSessao({ chave, salt: params.salt, iterations: params.iterations })
      return true
    }
    return false
  }

  // 2. Primeiro desbloqueio neste dispositivo (online): valida contra o manifesto.
  const token = await ctx.tokenProvider()
  const { bytes } = await drive.baixarArquivoComEtag(token, ctx.vaultId)
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
  const chave = await derivarChave(senha, salt, iterations, true)
  ctx.definirSessao({ chave, salt, iterations })
  await gravarVerificadorComSalt(ctx.vaultId, senha, salt)
  return true
}

export function bloquear(ctx: ContextoVault): void {
  ctx.limparSessao()
}

export async function ativarBiometria(ctx: ContextoVault, sessao: SessaoCripto, email: string): Promise<void> {
  const chaveRaw = await exportarChaveRaw(sessao.chave)
  await configurarBiometria(ctx.vaultId, chaveRaw, sessao.salt, sessao.iterations, email)
}

export async function desbloquearComBiometria(ctx: ContextoVault): Promise<boolean> {
  const { chaveRaw, salt, iterations } = await obterChaveComBiometria(ctx.vaultId)
  const chave = await importarChaveRaw(chaveRaw)
  ctx.definirSessao({ chave, salt, iterations })
  return true
}
