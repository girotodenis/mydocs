import type { Manifesto } from './entities'

export interface VaultRepository {
  carregarManifesto(): Promise<Manifesto>
  salvarManifesto(manifesto: Manifesto): Promise<void>
  /** Persiste o manifesto apenas no cache local (uso offline), sem tocar no Drive. */
  salvarManifestoLocal(manifesto: Manifesto): Promise<void>
}

export interface ItemStore {
  enviar(itemId: string, envelope: Uint8Array, mime: string): Promise<string>
  baixar(blobId: string): Promise<Uint8Array>
  excluir(blobId: string): Promise<void>
}

export interface CryptoProvider {
  derivarChave(senha: string, salt: Uint8Array, iterations: number): Promise<CryptoKey>
  cifrar(chave: CryptoKey, iv: Uint8Array, plaintext: Uint8Array, aad: Uint8Array): Promise<Uint8Array>
  decifrar(chave: CryptoKey, iv: Uint8Array, ciphertext: Uint8Array, aad: Uint8Array): Promise<Uint8Array>
}

export interface ArquivoRecebido {
  nome: string
  mime: string
  bytes: Uint8Array
}

export interface SharePort {
  compartilharArquivo(nome: string, mime: string, bytes: Uint8Array): Promise<void>
}

export interface ShareTargetPort {
  lerRecebidos(): Promise<{ title?: string; text?: string; url?: string; files: ArquivoRecebido[] }>
}

export interface Clock {
  agoraIso(): string
}
