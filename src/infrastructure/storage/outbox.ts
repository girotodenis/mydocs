import { gravar, iniciarKv, lerSync } from './kvStore'

const STORE = 'outbox'
const CHAVE = 'fila'

export type Mutacao =
  | { tipo: 'upload'; itemId: string; mime: string; envelopeB64: string }
  | { tipo: 'excluirBlob'; blobId: string }
  | { tipo: 'salvarManifesto' }

let pendentes: Mutacao[] = []

export async function iniciarOutbox(): Promise<void> {
  await iniciarKv(STORE)
  const raw = lerSync(STORE, CHAVE)
  pendentes = raw ? (JSON.parse(raw) as Mutacao[]) : []
}

async function persistir(): Promise<void> {
  await gravar(STORE, CHAVE, JSON.stringify(pendentes))
}

export async function enfileirar(mut: Mutacao): Promise<void> {
  pendentes.push(mut)
  await persistir()
}

export function listarPendentes(): Mutacao[] {
  return [...pendentes]
}

export function contarPendencias(): number {
  return pendentes.length
}

export async function limparFila(): Promise<void> {
  pendentes = []
  await persistir()
}
