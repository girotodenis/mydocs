# MyDocs — Escopo do MVP

> Cofre pessoal de arquivos (imagens, documentos e notas) no Google Drive,
> compactados e criptografados antes do upload. PWA offline-first, com editor
> de Markdown/HTML e compartilhamento nativo no celular.

---

## 1. Visão

O **MyDocs** é um aplicativo web instalável (PWA) que funciona como um **cofre
pessoal de arquivos**. O usuário faz login com a conta Google e os arquivos são
guardados **numa pasta exclusiva do app no Google Drive** — mas **nunca em
claro**: todo arquivo é **compactado (gzip) e criptografado (AES-256-GCM) antes
de sair do dispositivo**, de forma obrigatória.

Dentro do cofre o usuário organiza os arquivos em **subpastas**, **move/renomeia**
itens e **visualiza** imagens, textos e markdown. Um **editor integrado de
Markdown/HTML** permite criar e editar notas. No celular, o app se integra ao
sistema nos **dois sentidos**: **compartilhar arquivos com outros aplicativos**
(ex.: abrir uma foto no WhatsApp) e **receber conteúdo de outros aplicativos**
(ex.: salvar no cofre uma foto vinda do WhatsApp/Galeria).

O app não tem servidor próprio: é uma "janela" sobre o Drive do usuário, com
**cache local também criptografado** e sincronização offline.

---

## 2. Objetivos do MVP

Entregar um cofre funcional de ponta a ponta que resolva o fluxo principal:

1. Autenticar com o Google e criar/abrir o cofre na pasta exclusiva do app.
2. Enviar arquivos (máx. **5 MB**) que são **sempre** compactados e cifrados antes do upload.
3. Organizar em subpastas virtuais: criar, renomear, mover e excluir.
4. Visualizar **imagens**, **texto** e **markdown** dentro do app.
5. Criar/editar notas com **editor de Markdown/HTML**.
6. Instalar como PWA e usar **offline** (leitura do cache; fila de alterações).
7. No celular, **compartilhar** um arquivo com outros apps.
8. No celular, **receber** conteúdo de outros apps e salvá-lo no cofre.

---

## 3. Não-objetivos (fora do MVP)

- Edição de PDF, Office ou vídeo; busca full-text avançada → fase 2.
- Compartilhamento entre usuários (multi-conta/equipe) → fora de escopo.
- Versionamento/lixeira com restauração → o MVP usa exclusão definitiva com confirmação.
- Sincronização seletiva por pasta (baixar só algumas pastas) → fase 2.
- WebDAV/DRIVE nativo (montar o cofre como disco) → fora de escopo.
- Servidor/backup próprios, analytics e telemetria.

---

## 4. Personas e histórias de usuário

**Persona 1 — Ana (uso pessoal, celular):** guarda fotos de documentos e quer
abri-los de qualquer lugar sem que o Google "leia" o conteúdo.

- "Quero enviar a foto de um comprovante e ter certeza de que só eu, com minha
  senha, consigo abri-la."
- "Quero compartilhar a foto no WhatsApp direto do app, sem precisar baixar e
  reenviar manualmente."

**Persona 2 — Carlos (notas e organização):** usa o cofre como caderno digital.

- "Quero criar uma nota em Markdown com preview e guardá-la numa subpasta."
- "Quero mover arquivos entre subpastas arrastando/fazendo poucos toques."

---

## 5. Decisões de escopo

| Decisão | Escolha para o MVP | Alternativa adiada |
| --- | --- | --- |
| Como os arquivos ficam no Drive | **Um arquivo por item** (blob cifrado, nome opaco UUID) + **1 manifesto cifrado** com a árvore de pastas e metadados | Um único arquivo JSON gigante (como no app de carteira) — descartado por causa do limite de 5 MB por arquivo e do custo de reescrever tudo |
| Subpastas | **Virtuais** (definidas no manifesto) — nomes privados, mover/renomear é só editar o manifesto | Pastas nativas do Drive — vazaria nomes/estrutura |
| Criptografia | **Obrigatória**, por arquivo, `gzip` antes de `AES-256-GCM` | Cifra opcional |
| Limite de tamanho | **5 MB por arquivo**, validado no cliente antes de compactar | Upload chunked/retomável (fase 2) |
| Cache local | IndexedDB guardando **apenas envelopes cifrados** + verificador de desbloqueio offline | Cache em claro |
| Compartilhamento | **Saída** (Web Share API): decifrar → `Blob` → `navigator.share` **e Entrada** (Web Share Target API): receber arquivos/texto de outros apps no cofre | (nenhuma — as duas direções entram no MVP) |
| Editor | **CodeMirror 6** (`@uiw/react-codemirror`) para Markdown/HTML; preview com `react-markdown` + `remark-gfm` (`.md`) e `iframe` sandbox/`srcDoc` (`.html`); notas como `.md`/`.html` | WYSIWYG (TipTap/ProseMirror) / collaborative |
| Mime-types de visualização | Imagens (`png`, `jpg`, `jpeg`, `gif`, `webp`, `svg`), texto puro (`txt`, `csv`, `json`, `log`, `md`…) e HTML/Markdown renderizado | PDF, Office, vídeo (fase 2) |
| Layout e tema | Mesmo padrão visual do app de carteira (header sticky + navegação em pílulas, banner offline, footer, container `max-w-6xl`) + **alternância claro/escuro** (Tailwind `darkMode: 'class'`, preferência salva, fallback no tema do sistema) | Tema customizado / múltiplos temas |

---

## 6. Requisitos funcionais (RF)

| ID | Requisito |
| --- | --- |
| **RF01** | O app deve autenticar com o Google via OAuth 2.0 usando apenas o escopo **`drive.file`** (não sensível), sem backend próprio. |
| **RF02** | O app deve criar (ou localizar) uma **pasta exclusiva** do projeto no Drive (ex.: `mydocs_vault`) para guardar o cofre. |
| **RF03** | Todo arquivo enviado deve ser **compactado (gzip) e criptografado (AES-256-GCM) antes do upload** — criptografia é obrigatória e não pode ser desativada. |
| **RF04** | O app deve **recusar arquivos maiores que 5 MB**, com validação no cliente antes de qualquer processamento. |
| **RF05** | O usuário deve poder **criar subpastas** dentro do cofre (pastas virtuais). |
| **RF06** | O usuário deve poder **mover** arquivos entre subpastas e **renomear** arquivos/pastas. |
| **RF07** | O usuário deve poder **excluir** arquivos e subpastas (com confirmação explícita). |
| **RF08** | O usuário deve poder **visualizar imagens** decifradas dentro do app (com zoom básico). |
| **RF09** | O usuário deve poder **visualizar arquivos de texto** (txt, csv, json, log etc.) decifrados. |
| **RF10** | O usuário deve poder **visualizar Markdown renderizado**. |
| **RF11** | O app deve ter um **editor de Markdown** (com preview) para criar/editar notas salvas como `.md`. |
| **RF12** | O editor deve ter um **modo HTML** para criar/editar notas salvas como `.html` (com preview). |
| **RF13** | O app deve ser um **PWA instalável** (manifest + service worker). |
| **RF14** | O app deve funcionar **offline**: leitura do cache local (cifrado) e fila de alterações (outbox) reaplicada ao reconectar. |
| **RF15** | No celular, o usuário deve poder **compartilhar um arquivo** com outros apps (Web Share API) — ex.: abrir uma foto no WhatsApp; o app decifra o arquivo para `Blob` e chama o share nativo. |
| **RF16** | No celular, o usuário deve poder **receber conteúdo compartilhado de outros apps** (Web Share Target API) — ex.: uma foto vinda da Galeria/WhatsApp abre o MyDocs para ser salva no cofre. |
| **RF17** | O usuário deve poder **baixar/exportar** um arquivo decifrado para o dispositivo. |
| **RF18** | O app deve listar os arquivos com metadados (nome, tipo, tamanho, data de modificação). |
| **RF19** | O app deve pedir a senha de desbloqueio **toda vez** que o cofre for aberto/trocado e permitir **bloquear agora** (esquecer a chave em memória). |
| **RF20** | O app deve suportar **múltiplos cofres** (criar novo / abrir existente), como no app de carteira. |

---

## 7. Requisitos não funcionais (RNF)

| ID | Requisito |
| --- | --- |
| **RNF01** | **100% client-side**: autenticação e chamadas ao Google acontecem no navegador; sem servidor, sem banco próprio. |
| **RNF02** | Criptografia forte: **AES-256-GCM** com chave derivada por **PBKDF2-HMAC-SHA256 (600.000 iterações)**, IV novo por escrita, AAD no cabeçalho. |
| **RNF03** | **Cache local criptografado**: o IndexedDB nunca persiste conteúdo em claro; guarda envelopes cifrados e o verificador de desbloqueio offline. |
| **RNF04** | **Privacidade de metadados**: nomes de arquivos/pastas e a estrutura vivem apenas dentro do manifesto cifrado — o Drive só vê UUIDs opacos. |
| **RNF05** | **Limite de 5 MB por arquivo** (validado antes de compactar/cifrar). |
| **RNF06** | **Offline-first**: leitura cache-first; escritas offline vão para outbox e sincronizam ao reconectar. |
| **RNF07** | **Mobile-first**: a interface deve ser usável por toque em telas pequenas. |
| **RNF08** | **Sem recuperação de senha**: senha esquecida = dados perdidos (avisar explicitamente). |
| **RNF09** | Service worker habilitado **apenas em produção** (não no `npm run dev`). |
| **RNF10** | Desempenho: a decifra é **sob demanda** (só o item aberto), e listagens usam o manifesto em memória. |
| **RNF11** | **Tema claro/escuro**: alternância manual com preferência persistida e respeito ao tema do sistema por padrão. |

---

## 8. Critérios de aceite (Definição de Pronto)

- [ ] Login com Google cria/abre o cofre na pasta exclusiva, sem pedir escopos sensíveis.
- [ ] Um arquivo enviado aparece na nuvem como blob opaco (UUID) e **não** é legível sem a senha.
- [ ] Arquivo > 5 MB é recusado antes de enviar.
- [ ] Criar subpasta, mover e renomear funcionam e persistem após recarregar.
- [ ] Imagens, `.txt` e `.md` abrem e exibem corretamente (decifrados).
- [ ] Nota criada no editor Markdown/HTML é salva no cofre e reabre editável.
- [ ] Instalado como PWA, o app abre **offline** e reaplica as alterações pendentes ao voltar a rede.
- [ ] No celular, "Compartilhar" abre a folha nativa do sistema com o arquivo decifrado (ex.: enviar para WhatsApp).
- [ ] No celular, compartilhar a partir de outro app (ex.: Galeria/WhatsApp) abre o MyDocs para salvar o conteúdo no cofre.
- [ ] O cache local (IndexedDB) não contém conteúdo em claro.

---

## 9. Riscos e mitigações

| Risco | Mitigação |
| --- | --- |
| Perda de senha = perda total dos dados | Aviso explícito ("Entendi que não há recuperação") + verificador de desbloqueio offline; nunca gravar a chave. |
| Estouro do espaço/limites do Drive | Limite de 5 MB/arquivo; mostrar o tamanho total e o uso; tratamento de quota (HTTP 403/quota) no outbox. |
| Conflito de escrita concorrente no manifesto | `etag` + `If-Match` (read-modify-write); em HTTP 412, reler e reaplicar — mesmo padrão do app de carteira. |
| Compartilhar exige decifrar e criar `Blob` grande | Decifra sob demanda, apenas do item compartilhado; revogar object URLs após o uso. |
| Navegadores que não suportam Web Share | Fallback para download do arquivo decifrado. |
| `gzip` de arquivos já comprimidos (jpg/zip) com ganho baixo | Aceitar o custo: a compressão garante o formato único do envelope; manter o gzip antes da cifra por uniformidade. |
