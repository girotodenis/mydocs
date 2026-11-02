# MyDocs — Plano de Implementação (fases)

Plano incremental do MVP. Cada fase termina com **build/testes verdes** e um
**commit local**. Marque os itens conforme forem concluídos.

> Escopo e arquitetura: ver [`ESCOPO_MVP.md`](./ESCOPO_MVP.md) e
> [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Fase 0 — Fundação do repositório

- [x] Repositório git inicializado (branch `develop`)
- [x] Documentos de escopo e arquitetura versionados
- [x] `.gitignore`, `.env.example` e este plano

**Commit:** `chore: fundação do repositório e documentação`

---

## Fase 1 — Scaffold e layout base

- [x] Vite + React 18 + TypeScript configurado
- [x] Tailwind CSS com `darkMode: 'class'` + paleta `brand`/`slate`
- [x] `vite-plugin-pwa` (manifest + service worker desligado em dev)
- [x] Estrutura de pastas `domain/ application/ infrastructure/ presentation/`
- [x] `AppLayout` replicando o app de carteira (header sticky, nav em pílulas, banner offline, footer)
- [x] Toggle de tema claro/escuro (Sol/Lua) com preferência persistida

**Commit:** `feat: scaffold e layout base com tema claro/escuro`

---

## Fase 2 — Domínio (regras de negócio puras)

- [x] Modelos: `Vault`, `Item`, `PastaVirtual`, `Manifesto`, `Nota`
- [x] Tipos/validações: `itemId`, `mime`, `tamanho`, `nome`
- [x] `arvore.ts` (criar/mover/renomear/resolver caminho)
- [x] `validacaoUpload.ts` (limite de 5 MB, mime permitido)
- [x] `preview.ts` (classificar imagem/texto/markdown/html/outro)
- [x] `editor.ts` (serializar `.md`/`.html`)
- [x] `envelope.ts` (magic/cabeçalho — puro, sem Web Crypto)
- [x] `ports.ts` (contratos)
- [x] Testes unitários (Vitest) dos módulos puros

**Commit:** `feat: domínio com regras de negócio puras e testes`

---

## Fase 3 — Infraestrutura de criptografia e compressão

- [x] `cripto/webCrypto.ts` (PBKDF2-SHA256 + AES-256-GCM)
- [x] `cripto/envelope.ts` (cifrar/decifrar blob)
- [x] `cripto/chaveSessao.ts` (chave só em memória)
- [x] `cripto/verificadorLocal.ts` (desbloqueio offline)
- [x] `compression.ts` (gzip `CompressionStream`)

**Commit:** `feat: infraestrutura de criptografia e compressão`

---

## Fase 4 — Infraestrutura de armazenamento local

- [x] `storage/db.ts` + `kvStore.ts` (IndexedDB com espelho em memória)
- [x] `storage/cache.ts` (cache de envelopes cifrados)
- [x] `storage/outbox.ts` (fila offline)
- [x] `storage/offlineRepositories.ts` (escrita otimista + fila)

**Commit:** `feat: armazenamento local cifrado (IndexedDB)`

---

## Fase 5 — Infraestrutura de Google Drive e cofre

- [x] `drive/api.ts` (primitivas HTTP `drive.file`, timeout)
- [x] `drive/pasta.ts` (`ensureAppFolder` → `mydocs_vault`)
- [x] `vault/manifestoCodec.ts` (schema/normalização do manifesto)
- [x] `vault/itemCodec.ts` (item ⇄ registro do manifesto)
- [x] `vault/vaultRepository.ts` (read-modify-write, etag + `If-Match`)
- [x] `vault/itemStore.ts` (upload/leitura/remoção dos blobs)

**Commit:** `feat: infraestrutura do Google Drive e cofre`

---

## Fase 6 — Casos de uso (application)

- [x] `vault.ts` (abrir/criar cofre, carregar manifesto)
- [x] `pastas.ts` (criar/renomear/excluir pastas)
- [x] `itens.ts` (upload/mover/renomear/excluir)
- [x] `preview.ts` (abrir/decifrar item sob demanda)
- [x] `editor.ts` (criar/editar notas)
- [x] `share.ts` (Web Share API + fallback download)
- [x] `recebidos.ts` (processar share target)
- [x] `criptografia.ts` (desbloquear/bloquear/estado)
- [x] `sync.ts` (sincronização FIFO + reconexão)

**Commit:** `feat: casos de uso da aplicação`

---

## Fase 7 — Apresentação (telas e interações)

- [x] Providers: `auth` e `theme`
- [x] Rotas (cofre, visualizador, editor, configurações, recebidos)
- [x] Tela do cofre (listagem, pastas, upload, mover/renomear/excluir)
- [x] Visualizador de imagem/texto/markdown
- [x] Editor Markdown/HTML (CodeMirror 6 + preview)
- [x] Ações de compartilhar/baixar (Web Share)

**Commit:** `feat: apresentação — telas, editor e visualizador`

---

## Fase 8 — PWA, share target e validação final

- [x] Manifest com `share_target` (POST multipart)
- [x] Service worker tratando o `POST` do share target (inbox)
- [x] Fallback desktop (arrastar/soltar + seletor)
- [x] `npm run build`, `npm test`, `npm run lint` verdes
- [x] Ajustes finais e revisão dos critérios de aceite

**Commit:** `feat: PWA, share target e validação final`
