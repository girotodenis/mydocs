import type { VaultRepository } from '@/domain/ports'
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
      const sessao = deps.obterSessao()
      if (!sessao) throw new ChaveNecessariaError()
      const claro = serializarManifesto(manifesto)
      const comprimido = await comprimirGzip(claro)
      const envelope = await cifrarComChaveComSalt(sessao.chave, sessao.salt, sessao.iterations, comprimido)
      const { etag } = await drive.atualizarArquivo(token, deps.vaultFileId, envelope, deps.obterEtag())
      deps.definirEtag(etag)
      await salvarManifestoCache(deps.vaultFileId, envelope)
    },
  }
}
