## [FE-PROJ-016] Download por URL assinada — resolveDownloadUrl, window.open, sem proxy de bytes

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
Ao clicar em "Baixar" (T08) ou quick-download (T02), a SPA chama `resolveDownloadUrl()`,
recebe a `arquivoUrl` assinada e abre diretamente em nova aba (`window.open(url, '_blank')`).
A SPA nunca faz proxy dos bytes do artifact — o object storage serve diretamente (D-F).

**Context / Problem statement:**
- SPEC-04 §3 define o fluxo D-F: SPA minta a URL via `GET .../download` e delega ao object storage.
- A URL é de TTL curto e gerada por clique — não armazenada no VM.
- Quick-download no card T02: `canQuickDownload` habilita o botão; o clique chama `onQuickDownload(card)`.
- Download de linha T08: `canDownload` habilita o botão da linha; o clique chama `onDownload(row)`.
- Em caso de URL 404 / expirada: inline row feedback + "Tentar novamente" (re-minta a URL) (SPEC-07 §1).

**Approach (execution path):**
1. Em `BibliotecaDeProjetosComponent.onQuickDownload(card)`:
   - Chama `ProjetoApiService.resolveDownloadUrl(card.id, latestPublicacaoId)`.
   - Em resposta: `window.open(response.arquivoUrl, '_blank')`.
   - Em erro: inline feedback no card (sem mudar status).
2. Em `DownloadEHistoricoComponent.onDownload(row)`:
   - Chama `ProjetoApiService.resolveDownloadUrl(row.projetoId, row.publicacaoId)`.
   - Em resposta: `window.open(response.arquivoUrl, '_blank')`.
   - Em erro 404: inline feedback na linha; botão "Tentar novamente" re-emite o request.
3. Criar helper `openSignedUrl(url: string): void` em `libs/proj/data-access` para isolar
   `window.open` e facilitar o stub nos testes.

**Non-goals:**
- A SPA nunca faz `fetch`/`HttpClient.get(arquivoUrl)` (proibido por D-F).
- Não implementa polling ou pre-mint de URL.

**Layer(s):**
frontend / libs/proj/data-access + libs/proj/feature-library + libs/proj/feature-history

**Bounded context:**
proj

**Service execution spec(s):**
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-04-data-access.md` (§3)
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-07-error-handling.md` (§1 — signed URL 404)

**Architecture alignment:**
- Tag Nx: `scope:proj`, `type:data-access`
- `window.open` isolado em helper testável (substituível por spy no Jest/JSDOM)

**Implementation checklist (by file):**

**Lib: libs/proj/data-access**
- 🔲 `libs/proj/data-access/src/lib/download/open-signed-url.helper.ts`

**Lib: libs/proj/feature-library**
- 🔲 Adicionar `onQuickDownload()` handler em `BibliotecaDeProjetosComponent`
- 🔲 Inline feedback no card em caso de erro de download

**Lib: libs/proj/feature-history**
- 🔲 Adicionar `onDownload(row)` handler em `DownloadEHistoricoComponent`
- 🔲 Inline feedback na linha (SPEC-07 §1 — signed URL 404)

**Tests**
- 🔲 `nx test proj-feature-library` PASS — `onQuickDownload` chama `resolveDownloadUrl` e `openSignedUrl` (spy)
- 🔲 `nx test proj-feature-history` PASS — erro 404 na URL → feedback inline; segundo clique re-minta
- 🔲 `nx test proj-data-access` PASS — `openSignedUrl` chama `window.open` com `_blank`
- 🔲 `nx lint proj-data-access` PASS

**Milestone:**
Wave 3 / P3 Feature Libraries

**Labels:**
type:feature
layer:frontend
scope:proj
priority:P3

**Acceptance criteria:**
- `npx nx test proj-feature-library` PASS
- `npx nx test proj-feature-history` PASS
- `npx nx lint proj-data-access` PASS
- Nenhum byte de artifact passa pelo `HttpClient` da SPA (verificado por lint rule ou teste)
- URL expirada → re-mint no próximo clique (não usa a URL cacheada)

**Dependencies:**
- FE-PROJ-007 (resolveDownloadUrl no ProjetoApiService)
- FE-PROJ-012 (BibliotecaDeProjetosComponent)
- FE-PROJ-014 (DownloadEHistoricoComponent)

**Data impact:**
- Nenhum (SPA não armazena artifact)

**API / Contract impact:**
- `GET /api/proj/projetos/{id}/publicacoes/{pid}/download` → `{ arquivoUrl, expiresAt }`

**Testing / Evidence required:**
- Spy em `window.open` confirma que é chamado com a URL assinada e `'_blank'`

**Risks / Notes:**
- JSDOM (Jest) não tem `window.open` real; usar `vi.spyOn(window, 'open')` ou equivalente Jest.
- O `latestPublicacaoId` para quick-download do card: verificar se o `ProjetoCardVM` inclui o
  campo ou se é necessário buscar `listPublicacoes` antes; se sim, reconsiderar o fluxo (pode
  virar um mini-HistoryFacade ou campo adicional no card VM).
