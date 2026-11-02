import type { SharePort } from '@/domain/ports'

export function criarSharePort(): SharePort {
  return {
    async compartilharArquivo(nome, mime, bytes) {
      const file = new File([new Uint8Array(bytes)], nome, { type: mime })
      if (typeof navigator.share === 'function' && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ files: [file], title: nome })
        return
      }
      const url = URL.createObjectURL(file)
      const a = document.createElement('a')
      a.href = url
      a.download = nome
      a.click()
      URL.revokeObjectURL(url)
    },
  }
}
