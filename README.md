# MyDocs

Cofre pessoal de arquivos (imagens, documentos e notas) no Google Drive,
**compactados e criptografados antes do upload** — 100% no navegador, sem
backend próprio. PWA offline-first com editor de Markdown/HTML e
compartilhamento nativo no celular.

## Documentos

- **[ESCOPO_MVP.md](./ESCOPO_MVP.md)** — visão, decisões de escopo, requisitos
  funcionais (RF) e não funcionais (RNF), critérios de aceite e riscos do MVP.
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — arquitetura em camadas (Clean
  Architecture / Ports & Adapters), modelo de armazenamento, criptografia,
  PWA/offline e convenções.

## Como funciona

1. **Abra o app e use.** Na primeira vez você só escolhe uma senha para o cofre;
   nada de conta Google e nenhum login. Os arquivos ficam cifrados no próprio
   dispositivo (IndexedDB) e reabrem sem pedir a senha de novo — até você tocar
   em **Bloquear**.
2. **Sincronize quando quiser.** Um botão vermelho **“Não sincronizado”** no
   cabeçalho mostra que o cofre está só neste dispositivo. Ao tocar, o app faz o
   login Google (ou renova o token), cria o cofre no Drive se ainda não existir
   ou atualiza o existente — enviando o que está local e trazendo o que está no
   Drive, **sem pedir a senha do cofre outra vez**.
3. **Se já houver um cofre no Drive com outra chave** (mesmo com a mesma senha,
   cada cofre tem seu próprio salt), o app avisa e oferece: informar a senha
   daquele cofre para **abrir e juntar tudo** — os arquivos deste dispositivo são
   recifrados e enviados, nada é perdido — ou criar um cofre novo, renomeando a
   pasta antiga e preservando-a como backup.
4. **Desconectar Google** remove só o acesso ao Drive; o cofre continua aberto e
   utilizável localmente.

## Status

Em definição — fase de escopo e arquitetura. A implementação (base
React 18 + TypeScript + Vite, Tailwind, `vite-plugin-pwa`, Google Drive
`drive.file`) segue a mesma arquitetura do projeto **Minhas Ações**
(`/home/dsgiroto/Projetos/aiterminal/projetos/renda`).
