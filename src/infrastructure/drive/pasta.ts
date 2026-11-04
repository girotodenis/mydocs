import { buscarPastaPorNome, criarPastaDrive, renomearArquivo } from './api'

export async function garantirPastaApp(token: string, nome: string): Promise<string> {
  const existente = await buscarPastaPorNome(token, nome)
  if (existente) return existente
  return criarPastaDrive(token, nome)
}

/**
 * Renomeia a pasta do app (guardando o cofre antigo como backup) para que um
 * novo cofre possa ser criado no mesmo lugar sem apagar nada.
 */
export async function arquivarPastaApp(token: string, nome: string, sufixo: string): Promise<boolean> {
  const existente = await buscarPastaPorNome(token, nome)
  if (!existente) return false
  await renomearArquivo(token, existente, `${nome}_${sufixo}`)
  return true
}
