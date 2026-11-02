import { buscarPastaPorNome, criarPastaDrive } from './api'

export async function garantirPastaApp(token: string, nome: string): Promise<string> {
  const existente = await buscarPastaPorNome(token, nome)
  if (existente) return existente
  return criarPastaDrive(token, nome)
}
