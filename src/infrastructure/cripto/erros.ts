export class ChaveNecessariaError extends Error {
  constructor() {
    super('A chave de desbloqueio é necessária')
    this.name = 'ChaveNecessariaError'
  }
}
