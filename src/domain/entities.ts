export type ItemId = string
export type PastaId = string
export type BlobId = string

export interface Item {
  id: ItemId
  nome: string
  mime: string
  tamanho: number
  pastaId: PastaId | null
  blobId: BlobId
  iv: string
  criadoEm: string
  atualizadoEm: string
}

export interface PastaVirtual {
  id: PastaId
  nome: string
  parentId: PastaId | null
  criadoEm: string
}

export interface Manifesto {
  version: number
  pastas: PastaVirtual[]
  itens: Item[]
}

export interface Vault {
  id: BlobId
  nome: string
  folderId: string
  manifesto: Manifesto
}
