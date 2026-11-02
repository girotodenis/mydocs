import { abrirEnvelope, montarEnvelope, type CabecalhoEnvelope } from '@/domain/envelope'
import {
  base64ParaBytes,
  bytesBase64,
  cifrarGCM,
  decifrarGCM,
  derivarChave,
  randomBytes,
} from './webCrypto'

const ITERATIONS = 600_000

function aadDoCabecalho(cabecalho: CabecalhoEnvelope): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(cabecalho) + '\n')
}

export async function cifrarComSenha(senha: string, plaintext: Uint8Array): Promise<Uint8Array> {
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const cabecalho: CabecalhoEnvelope = {
    v: 1,
    kdf: 'PBKDF2-SHA256',
    cipher: 'AES-256-GCM',
    iterations: ITERATIONS,
    salt: bytesBase64(salt),
    iv: bytesBase64(iv),
  }
  const chave = await derivarChave(senha, salt, ITERATIONS)
  const ciphertext = await cifrarGCM(chave, iv, plaintext, aadDoCabecalho(cabecalho))
  return montarEnvelope(cabecalho, ciphertext)
}

export async function decifrarComSenha(senha: string, envelope: Uint8Array): Promise<Uint8Array> {
  const aberto = abrirEnvelope(envelope)
  if (!aberto) throw new Error('Envelope inválido ou corrompido')
  const { cabecalho, ciphertext } = aberto
  const chave = await derivarChave(senha, base64ParaBytes(cabecalho.salt), cabecalho.iterations)
  return decifrarGCM(chave, base64ParaBytes(cabecalho.iv), ciphertext, aadDoCabecalho(cabecalho))
}
