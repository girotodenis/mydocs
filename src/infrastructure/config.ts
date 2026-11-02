import { LIMITE_PADRAO_BYTES } from '@/domain/tamanho'

export const MAX_FILE_BYTES = Number(import.meta.env.VITE_MAX_FILE_BYTES) || LIMITE_PADRAO_BYTES
