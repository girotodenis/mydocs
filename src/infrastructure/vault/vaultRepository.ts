import type { VaultRepository } from '@/domain/ports'
import type { Manifesto } from '@/domain/entities'
import { descomprimirGzip, comprimirGzip } from '@/infrastructure/compression'
import { decifrarComChave, cifrarComChaveComSalt } from '@/infrastructure/cripto/envelope'
import { ChaveNecessariaError } from '@/infrastructure/cripto/erros'
import type { SessaoCripto } from '@/infrastructure/cripto/chaveSessao'
import { salvarManifestoCache } from '@/infrastructure/storage/cache'
import * as drive from '../drive/api'
import { parseManifesto, serializarManifesto } from './manifestoCodec'

export interface DepsVaultRepository {
  tokenProvider: () => Promise<string>
  vaultFileId: string
  obterSessao: () => SessaoCripto | undefined
  obterEtag: () => string | undefined
  definirEtag: (etag?: string) => void
}

export function criarDriveVaultRepository(deps: DepsVaultRepository): VaultRepository {
  async function cifrarManifesto(manifesto: Manifesto): Promise<Uint8Array> {
    const sessao = deps.obterSessao()
    if (!sessao) throw new ChaveNecessariaError()
    const claro = serializarManifesto(manifesto)
    const comprimido = await comprimirGzip(claro)
    return cifrarComChaveComSalt(sessao.chave, sessao.salt, sessao.iterations, comprimido)
  }

  return {
    async carregarManifesto() {
      const token = await deps.tokenProvider()
      const { bytes, etag } = await drive.baixarArquivoComEtag(token, deps.vaultFileId)
      deps.definirEtag(etag)
      await salvarManifestoCache(deps.vaultFileId, bytes)
      const sessao = deps.obterSessao()
      if (!sessao) throw new ChaveNecessariaError()
      const comprimido = await decifrarComChave(sessao.chave, bytes)
      const claro = await descomprimirGzip(comprimido)
      return parseManifesto(claro)
    },
    async salvarManifesto(manifesto) {
      const token = await deps.tokenProvider()
      const envelope = await cifrarManifesto(manifesto)
      const { etag } = await drive.atualizarArquivo(token, deps.vaultFileId, envelope, deps.obterEtag())
      deps.definirEtag(etag)
      await salvarManifestoCache(deps.vaultFileId, envelope)
    },
    async salvarManifestoLocal(manifesto) {
      const envelope = await cifrarManifesto(manifesto)
      await salvarManifestoCache(deps.vaultFileId, envelope)
    },
  }
}
