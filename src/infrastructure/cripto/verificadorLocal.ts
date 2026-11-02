import {
  base64ParaBytes,
  bytesBase64,
  cifrarGCM,
  decifrarGCM,
  derivarChave,
  randomBytes,
} from './webCrypto'

const PREFIXO = 'mydocs:verificador:'
const ITERATIONS = 600_000
const PLAINTEXT = new TextEncoder().encode('MYDOCS-VERIFICADOR')

interface Registro {
  salt: string
  iv: string
  iterations: number
  bloco: string
}

export async function gravarVerificador(vaultId: string, senha: string): Promise<void> {
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const chave = await derivarChave(senha, salt, ITERATIONS)
  const bloco = await cifrarGCM(chave, iv, PLAINTEXT, new Uint8Array(0))
  const registro: Registro = {
    salt: bytesBase64(salt),
    iv: bytesBase64(iv),
    iterations: ITERATIONS,
    bloco: bytesBase64(bloco),
  }
  localStorage.setItem(PREFIXO + vaultId, JSON.stringify(registro))
}

export async function validarSenhaOffline(vaultId: string, senha: string): Promise<boolean> {
  const raw = localStorage.getItem(PREFIXO + vaultId)
  if (!raw) return false
  try {
    const registro = JSON.parse(raw) as Registro
    const chave = await derivarChave(senha, base64ParaBytes(registro.salt), registro.iterations)
    const claro = await decifrarGCM(
      chave,
      base64ParaBytes(registro.iv),
      base64ParaBytes(registro.bloco),
      new Uint8Array(0),
    )
    return new TextDecoder().decode(claro) === 'MYDOCS-VERIFICADOR'
  } catch {
    return false
  }
}

export function removerVerificador(vaultId: string): void {
  localStorage.removeItem(PREFIXO + vaultId)
}
