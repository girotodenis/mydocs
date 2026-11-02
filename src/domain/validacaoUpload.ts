import { MIME_PERMITIDO } from './mime'
import { nomeValido } from './nome'
import { LIMITE_PADRAO_BYTES } from './tamanho'

export interface ResultadoValidacao {
  ok: boolean
  motivo?: string
}

export function validarUpload(
  nome: string,
  tamanho: number,
  mime: string,
  limiteBytes = LIMITE_PADRAO_BYTES,
): ResultadoValidacao {
  if (!nomeValido(nome)) return { ok: false, motivo: 'Nome inválido' }
  if (tamanho <= 0) return { ok: false, motivo: 'Arquivo vazio' }
  if (tamanho > limiteBytes) {
    return { ok: false, motivo: `Arquivo excede o limite de ${Math.round(limiteBytes / (1024 * 1024))} MB` }
  }
  if (!(MIME_PERMITIDO as readonly string[]).includes(mime)) {
    return { ok: false, motivo: `Tipo de arquivo não suportado: ${mime}` }
  }
  return { ok: true }
}
