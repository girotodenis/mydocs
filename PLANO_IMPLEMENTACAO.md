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

- [ ] Vite + React 18 + TypeScript configurado
- [ ] Tailwind CSS com `darkMode: 'class'` + paleta `brand`/`slate`
- [ ] `vite-plugin-pwa` (manifest + service worker desligado em dev)
- [ ] Estrutura de pastas `domain/ application/ infrastructure/ presentation/`
- [ ] `AppLayout` replicando o app de carteira (header sticky, nav em pílulas, banner offline, footer)
- [ ] Toggle de tema claro/escuro (Sol/Lua) com preferência persistida

**Commit:** `feat: scaffold e layout base com tema claro/escuro`

---

## Fase 2 — Domínio (regras de negócio puras)

- [ ] Modelos: `Vault`, `Item`, `PastaVirtual`, `Manifesto`, `Nota`
- [ ] Tipos/validações: `itemId`, `mime`, `tamanho`, `nome`
- [ ] `arvore.ts` (criar/mover/renomear/resolver caminho)
- [ ] `validacaoUpload.ts` (limite de 5 MB, mime permitido)
- [ ] `preview.ts` (classificar imagem/texto/markdown/html/outro)
- [ ] `editor.ts` (serializar `.md`/`.html`)
- [ ] `envelope.ts` (magic/cabeçalho — puro, sem Web Crypto)
- [ ] `ports.ts` (contratos)
- [ ] Testes unitários (Vitest) dos módulos puros

**Commit:** `feat: domínio com regras de negócio puras e testes`

---

## Fase 3 — Infraestrutura de criptografia e compressão

- [ ] `cripto/webCrypto.ts` (PBKDF2-SHA256 + AES-256-GCM)
- [ ] `cripto/envelope.ts` (cifrar/decifrar blob)
- [ ] `cripto/chaveSessao.ts` (chave só em memória)
- [ ] `cripto/verificadorLocal.ts` (desbloqueio offline)
- [ ] `compression.ts` (gzip `CompressionStream`)

**Commit:** `feat: infraestrutura de criptografia e compressão`

---

## Fase 4 — Infraestrutura de armazenamento local

- [ ] `storage/db.ts` + `kvStore.ts` (IndexedDB com espelho em memória)
- [ ] `storage/cache.ts` (cache de envelopes cifrados)
- [ ] `storage/outbox.ts` (fila offline)
- [ ] `storage/offlineRepositories.ts` (escrita otimista + fila)

**Commit:** `feat: armazenamento local cifrado (IndexedDB)`

---

## Fase 5 — Infraestrutura de Google Drive e cofre

- [ ] `drive/api.ts` (primitivas HTTP `drive.file`, timeout)
- [ ] `drive/pasta.ts` (`ensureAppFolder` → `mydocs_vault`)
- [ ] `vault/manifestoCodec.ts` (schema/normalização do manifesto)
- [ ] `vault/itemCodec.ts` (item ⇄ registro do manifesto)
- [ ] `vault/vaultRepository.ts` (read-modify-write, etag + `If-Match`)
- [ ] `vault/itemStore.ts` (upload/leitura/remoção dos blobs)

**Commit:** `feat: infraestrutura do Google Drive e cofre`

---

## Fase 6 — Casos de uso (application)

- [ ] `vault.ts` (abrir/criar cofre, carregar manifesto)
- [ ] `pastas.ts` (criar/renomear/excluir pastas)
- [ ] `itens.ts` (upload/mover/renomear/excluir)
- [ ] `preview.ts` (abrir/decifrar item sob demanda)
- [ ] `editor.ts` (criar/editar notas)
- [ ] `share.ts` (Web Share API + fallback download)
- [ ] `recebidos.ts` (processar share target)
- [ ] `criptografia.ts` (desbloquear/bloquear/estado)
- [ ] `sync.ts` (sincronização FIFO + reconexão)

**Commit:** `feat: casos de uso da aplicação`

---

## Fase 7 — Apresentação (telas e interações)

- [ ] Providers: `auth` e `theme`
- [ ] Rotas (cofre, visualizador, editor, configurações, recebidos)
- [ ] Tela do cofre (listagem, pastas, upload, mover/renomear/excluir)
- [ ] Visualizador de imagem/texto/markdown
- [ ] Editor Markdown/HTML (CodeMirror 6 + preview)
- [ ] Ações de compartilhar/baixar (Web Share)

**Commit:** `feat: apresentação — telas, editor e visualizador`

---

## Fase 8 — PWA, share target e validação final

- [ ] Manifest com `share_target` (POST multipart)
- [ ] Service worker tratando o `POST` do share target (inbox)
- [ ] Fallback desktop (arrastar/soltar + seletor)
- [ ] `npm run build`, `npm test`, `npm run lint` verdes
- [ ] Ajustes finais e revisão dos critérios de aceite

**Commit:** `feat: PWA, share target e validação final`
