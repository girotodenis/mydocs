import { base64ParaBytes, bytesBase64 } from '@/infrastructure/cripto/webCrypto'
import { gravar, iniciarKv, lerSync, remover } from './kvStore'

const STORE = 'cache'

export async function iniciarCache(): Promise<void> {
  await iniciarKv(STORE)
}

function chaveManifesto(vaultId: string): string {
  return `manifesto:${vaultId}`
}

function chaveItem(vaultId: string, itemId: string): string {
  return `item:${vaultId}:${itemId}`
}

export async function salvarManifestoCache(vaultId: string, envelope: Uint8Array): Promise<void> {
  await gravar(STORE, chaveManifesto(vaultId), bytesBase64(envelope))
}

export function lerManifestoCache(vaultId: string): Uint8Array | undefined {
  const raw = lerSync(STORE, chaveManifesto(vaultId))
  return raw ? base64ParaBytes(raw) : undefined
}

export async function salvarItemCache(vaultId: string, itemId: string, envelope: Uint8Array): Promise<void> {
  await gravar(STORE, chaveItem(vaultId, itemId), bytesBase64(envelope))
}

export function lerItemCache(vaultId: string, itemId: string): Uint8Array | undefined {
  const raw = lerSync(STORE, chaveItem(vaultId, itemId))
  return raw ? base64ParaBytes(raw) : undefined
}

export async function removerItemCache(vaultId: string, itemId: string): Promise<void> {
  await remover(STORE, chaveItem(vaultId, itemId))
}
