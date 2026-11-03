import { base64ParaBytes, bytesBase64, cifrarGCM, decifrarGCM, importarChaveRaw, randomBytes } from './webCrypto'

const PREFIXO = 'mydocs:biometria:'
const CHAVE_SEM_SUPORTE = 'mydocs:biometria:sem-suporte'

interface RegistroBiometria {
  credentialId: string
  prfSalt: string
  iv: string
  bloco: string
  salt: string
  iterations: number
}

interface ResultadoPrf {
  prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } }
}

export function suporteBiometria(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext === true &&
    'credentials' in navigator &&
    typeof PublicKeyCredential !== 'undefined' &&
    localStorage.getItem(CHAVE_SEM_SUPORTE) === null
  )
}

export function marcarSemSuporteBiometria(): void {
  localStorage.setItem(CHAVE_SEM_SUPORTE, '1')
}

/**
 * Verificação assíncrona usada na abertura do app: além dos requisitos básicos,
 * confirma se existe um autenticador de plataforma com verificação biométrica.
 * Não dispara prompt ao usuário.
 */
export async function verificarSuporteBiometria(): Promise<boolean> {
  if (!suporteBiometria()) return false
  try {
    const cred = PublicKeyCredential as unknown as {
      isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>
    }
    if (typeof cred.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      return await cred.isUserVerifyingPlatformAuthenticatorAvailable()
    }
  } catch {
    // API indisponível: mantém o suporte básico já verificado.
  }
  return true
}

export function biometriaConfigurada(vaultId: string): boolean {
  return localStorage.getItem(PREFIXO + vaultId) !== null
}

export function removerBiometria(vaultId: string): void {
  localStorage.removeItem(PREFIXO + vaultId)
}

function rpId(): string {
  return window.location.hostname || 'localhost'
}

function base64url(bytes: Uint8Array | ArrayBuffer): string {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  return bytesBase64(u).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64urlDecode(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const resto = b64.length % 4
  const pad = resto === 0 ? '' : '='.repeat(4 - resto)
  return base64ParaBytes(b64 + pad)
}

async function derivarSegredo(credentialId: Uint8Array, prfSalt: Uint8Array): Promise<Uint8Array> {
  const publicKeyOptions = {
    challenge: randomBytes(32),
    rpId: rpId(),
    allowCredentials: [{ type: 'public-key' as const, id: credentialId }],
    userVerification: 'required' as const,
    extensions: { prf: { eval: { first: prfSalt } } },
  } as unknown as PublicKeyCredentialRequestOptions

  const assertion = (await navigator.credentials.get({ publicKey: publicKeyOptions })) as PublicKeyCredential | null
  if (!assertion) throw new Error('Falha na verificação biométrica.')

  const resultado = assertion.getClientExtensionResults() as ResultadoPrf
  const prf = resultado.prf
  // Alguns navegadores omitem o campo `enabled`; o que importa é vir o `first`.
  if (!prf || !prf.results?.first) {
    throw new Error('Este autenticador não suporta desbloqueio biométrico (PRF). Atualize o navegador/sistema.')
  }
  return new Uint8Array(prf.results.first) as Uint8Array
}

/**
 * Cria uma credencial WebAuthn (passkey) com a extensão PRF e usa o segredo
 * derivado para embrulhar a chave do cofre. O resultado fica apenas neste
 * dispositivo e só é liberado após a verificação biométrica.
 */
export async function configurarBiometria(
  vaultId: string,
  chaveRaw: Uint8Array,
  salt: Uint8Array,
  iterations: number,
  email: string,
): Promise<void> {
  if (!suporteBiometria()) throw new Error('Biometria não suportada neste navegador.')

  const prfSalt = randomBytes(32)
  const publicKeyOptions = {
    challenge: randomBytes(32),
    rp: { name: 'MyDocs', id: rpId() },
    user: { id: randomBytes(16), name: email || vaultId, displayName: email || 'MyDocs' },
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 },
      { type: 'public-key', alg: -257 },
    ],
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      userVerification: 'required',
      residentKey: 'required',
    },
    extensions: { prf: { eval: { first: prfSalt } } },
  } as unknown as PublicKeyCredentialCreationOptions

  const credential = (await navigator.credentials.create({ publicKey: publicKeyOptions })) as
    | PublicKeyCredential
    | null
  if (!credential) throw new Error('Não foi possível criar a credencial biométrica.')

  const credentialId = new Uint8Array(credential.rawId)

  // Tenta aproveitar o resultado PRF já devolvido na criação; se o autenticador
  // não o fornecer, faz uma nova solicitação (get) para derivar o segredo.
  const criado = credential.getClientExtensionResults() as ResultadoPrf
  let segredo: Uint8Array | null = null
  const primeiro = criado.prf?.results?.first
  if (primeiro) {
    segredo = new Uint8Array(primeiro) as Uint8Array
  }
  if (!segredo) {
    try {
      segredo = await derivarSegredo(credentialId, prfSalt)
    } catch (e) {
      if (e instanceof Error && e.message.includes('(PRF)')) {
        marcarSemSuporteBiometria()
      }
      throw e
    }
  }

  const chaveSegredo = await importarChaveRaw(segredo)
  const iv = randomBytes(12)
  const bloco = await cifrarGCM(chaveSegredo, iv, chaveRaw, new Uint8Array(0))

  const registro: RegistroBiometria = {
    credentialId: base64url(credentialId),
    prfSalt: bytesBase64(prfSalt),
    iv: bytesBase64(iv),
    bloco: bytesBase64(bloco),
    salt: bytesBase64(salt),
    iterations,
  }
  localStorage.setItem(PREFIXO + vaultId, JSON.stringify(registro))
}

/**
 * Desembrulha a chave do cofre usando a credencial biométrica deste
 * dispositivo. Lança se a biometria não estiver configurada ou se a
 * verificação falhar/cancelar.
 */
export async function desbloquearComBiometria(vaultId: string): Promise<{
  chaveRaw: Uint8Array
  salt: Uint8Array
  iterations: number
}> {
  if (!suporteBiometria()) throw new Error('Biometria não suportada neste navegador.')

  const raw = localStorage.getItem(PREFIXO + vaultId)
  if (!raw) throw new Error('Biometria não configurada neste dispositivo.')

  let registro: RegistroBiometria
  try {
    registro = JSON.parse(raw) as RegistroBiometria
  } catch {
    throw new Error('Dados biométricos inválidos. Configure novamente.')
  }

  const credentialId = base64urlDecode(registro.credentialId)
  const segredo = await derivarSegredo(credentialId, base64ParaBytes(registro.prfSalt))
  const chaveSegredo = await importarChaveRaw(segredo)
  const chaveRaw = await decifrarGCM(
    chaveSegredo,
    base64ParaBytes(registro.iv),
    base64ParaBytes(registro.bloco),
    new Uint8Array(0),
  )
  return { chaveRaw, salt: base64ParaBytes(registro.salt), iterations: registro.iterations }
}
