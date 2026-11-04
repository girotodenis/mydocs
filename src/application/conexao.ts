import type { Item, Manifesto } from '@/domain/entities'
import { abrirEnvelope } from '@/domain/envelope'
import { mesclarManifestos } from '@/domain/fusao'
import { decifrarComSenha } from '@/infrastructure/cripto/envelope'
import { ChaveNecessariaError } from '@/infrastructure/cripto/erros'
import { ITERACOES_KDF } from '@/infrastructure/cripto/constantes'
import type { SessaoCripto } from '@/infrastructure/cripto/chaveSessao'
import { gravarVerificadorComSalt } from '@/infrastructure/cripto/verificadorLocal'
import { base64ParaBytes, derivarChave } from '@/infrastructure/cripto/webCrypto'
import * as drive from '@/infrastructure/drive/api'
import type { DriveFileInfo } from '@/infrastructure/drive/api'
import { garantirPastaApp } from '@/infrastructure/drive/pasta'
import { lerItemCache, salvarManifestoCache } from '@/infrastructure/storage/cache'
import { manifestoVazio } from '@/infrastructure/vault/manifestoCodec'
import type { ContextoVault } from './contexto'
import { cifrarManifesto, decifrarManifesto } from './vault'

const NOME_MANIFESTO = 'mydocs.manifest'

/**
 * Existe um cofre no Drive que não pôde ser aberto com a chave atual (senha
 * diferente da usada no cofre local). A UI oferece entrar com a senha correta
 * ou criar um cofre novo, guardando o antigo.
 */
export class ConflitoDeSenhaError extends Error {
  constructor(readonly folderId: string) {
    super('Já existe um cofre no Google Drive criado com outra senha.')
    this.name = 'ConflitoDeSenhaError'
  }
}

export interface ResultadoConexao {
  folderId: string
  arquivoId: string
  manifesto: Manifesto
  enviados: number
  recebidos: number
}

interface ManifestoRemoto {
  arquivoId: string
  etag?: string
  manifesto: Manifesto
}

/**
 * Lista os manifestos da pasta do app do mais recente para o mais antigo. Pode
 * haver mais de um (cofres antigos/duplicados na mesma pasta), então a escolha
 * nunca é feita apenas pelo nome.
 */
async function listarManifestos(token: string, folderId: string): Promise<DriveFileInfo[]> {
  const arquivos = await drive.listarArquivos(token, folderId)
  return arquivos
    .filter((arquivo) => arquivo.name === NOME_MANIFESTO)
    .sort((a, b) => (b.modifiedTime ?? '').localeCompare(a.modifiedTime ?? ''))
}

/** Baixa e decifra o manifesto mais recente compatível com a chave atual. */
async function localizarManifesto(
  sessao: SessaoCripto,
  token: string,
  folderId: string,
): Promise<{ remoto: ManifestoRemoto | null; candidatos: DriveFileInfo[] }> {
  const candidatos = await listarManifestos(token, folderId)
  for (const candidato of candidatos) {
    const baixado = await drive.baixarArquivoComEtag(token, candidato.id)
    try {
      const manifesto = await decifrarManifesto(sessao, baixado.bytes)
      return { remoto: { arquivoId: candidato.id, etag: baixado.etag, manifesto }, candidatos }
    } catch {
      // Manifesto de outro cofre (outra senha): tenta o próximo.
    }
  }
  return { remoto: null, candidatos }
}

/**
 * Vincula o cofre local ao Google Drive usando a chave de sessão já derivada —
 * portanto sem pedir a senha de novo:
 *
 * - se ainda não existe cofre no Drive, cria o manifesto e envia os blobs locais;
 * - se já existe, baixa, mescla com o local e atualiza manifesto + blobs.
 */
export async function conectarCofreAoServidor(
  ctx: ContextoVault,
  folderNome: string,
): Promise<ResultadoConexao> {
  const sessao = ctx.obterSessao()
  if (!sessao) throw new ChaveNecessariaError()

  const token = await ctx.tokenProvider()
  const folderId = await garantirPastaApp(token, folderNome)
  const { remoto, candidatos } = await localizarManifesto(sessao, token, folderId)
  if (!remoto && candidatos.length > 0) throw new ConflitoDeSenhaError(folderId)

  const local = ctx.lerManifesto() ?? manifestoVazio()
  const remotoManifesto = remoto?.manifesto ?? manifestoVazio()
  const mesclado = remoto ? mesclarManifestos(local, remotoManifesto) : local
  const { manifesto, enviados } = await enviarBlobsFaltantes(ctx, token, folderId, mesclado, remotoManifesto)

  const envelope = await cifrarManifesto(sessao, manifesto)
  const arquivoId = remoto
    ? await atualizarManifesto(token, remoto.arquivoId, envelope, remoto.etag)
    : await drive.criarArquivoMultipart(token, NOME_MANIFESTO, envelope, folderId)

  await salvarManifestoCache(ctx.vaultId, envelope)

  const idsLocais = new Set(local.itens.map((i) => i.id))
  const recebidos = remotoManifesto.itens.filter((i) => !idsLocais.has(i.id)).length
  return { folderId, arquivoId, manifesto, enviados, recebidos }
}

/**
 * Abre o cofre que já existe no Drive com a senha correta dele e passa a usá-lo
 * neste dispositivo. O conteúdo do cofre local (cifrado com outra senha) deixa
 * de ser exibido — é o custo de voltar a sincronizar.
 */
export async function adotarCofreDoDrive(
  ctx: ContextoVault,
  folderId: string,
  senha: string,
): Promise<{ arquivoId: string; manifesto: Manifesto }> {
  const token = await ctx.tokenProvider()
  const candidatos = await listarManifestos(token, folderId)

  for (const candidato of candidatos) {
    let bytes: Uint8Array
    try {
      bytes = (await drive.baixarArquivoComEtag(token, candidato.id)).bytes
    } catch {
      continue
    }
    const aberto = abrirEnvelope(bytes)
    if (!aberto || aberto.cabecalho.kdf === 'sessao' || !aberto.cabecalho.iterations) continue

    try {
      await decifrarComSenha(senha, bytes) // lança se a senha estiver errada
    } catch {
      continue
    }

    const salt = base64ParaBytes(aberto.cabecalho.salt || '')
    const iterations = aberto.cabecalho.iterations || ITERACOES_KDF
    const sessao = { chave: await derivarChave(senha, salt, iterations), salt, iterations }
    ctx.definirSessao(sessao)
    await gravarVerificadorComSalt(ctx.vaultId, senha, salt)

    const manifesto = await decifrarManifesto(sessao, bytes)
    await salvarManifestoCache(ctx.vaultId, bytes)
    return { arquivoId: candidato.id, manifesto }
  }

  throw new Error('Senha incorreta para o cofre do Google Drive.')
}

async function atualizarManifesto(
  token: string,
  arquivoId: string,
  envelope: Uint8Array,
  etag?: string,
): Promise<string> {
  try {
    await drive.atualizarArquivo(token, arquivoId, envelope, etag)
  } catch (e) {
    // 412 = o manifesto mudou entre a leitura e a escrita. O conteúdo é o mesmo
    // que o usuário vê agora, então reescreve sem precondition.
    if (!(e instanceof Error) || !e.message.includes('412')) throw e
    await drive.atualizarArquivo(token, arquivoId, envelope)
  }
  return arquivoId
}

/**
 * Sobe para o Drive os blobs que só existem localmente (ou cuja versão local é
 * mais recente) e devolve o manifesto com os `blobId` corrigidos.
 */
async function enviarBlobsFaltantes(
  ctx: ContextoVault,
  token: string,
  folderId: string,
  manifesto: Manifesto,
  remoto: Manifesto,
): Promise<{ manifesto: Manifesto; enviados: number }> {
  let enviados = 0
  const itens: Item[] = []

  for (const item of manifesto.itens) {
    const remotoItem = remoto.itens.find((r) => r.id === item.id)
    const envelope = lerItemCache(ctx.vaultId, item.id)
    const precisaEnviar =
      Boolean(envelope) &&
      (!remotoItem || remotoItem.blobId === item.id || item.atualizadoEm > remotoItem.atualizadoEm)

    if (!precisaEnviar) {
      itens.push(item)
      continue
    }
    const blobId = await drive.criarArquivoMultipart(token, item.id, envelope!, folderId)
    enviados += 1
    itens.push({ ...item, blobId })
  }

  return { manifesto: { ...manifesto, itens }, enviados }
}
