export const LIMITE_PADRAO_BYTES = 5 * 1024 * 1024

export function dentroDoLimite(bytes: number, limite = LIMITE_PADRAO_BYTES): boolean {
  return bytes > 0 && bytes <= limite
}

export function formatarBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
