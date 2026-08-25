## [FE-PUB-008] ArtifactDownloadService — getSignedUrl, download (signed-URL, nunca byte stream)

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/pub/data-access/src/lib/services/artifact-download.service.ts` implementa
`getSignedUrl(projetoId, publicacaoId)` (GET §4.4, curto TTL) e `download(projetoId, publicacaoId)`
que abre o arquivoUrl diretamente no browser — PUB nunca faz proxy dos bytes do ePub.
Em caso de URL expirada/401/404, o service re-busca uma URL fresca automaticamente.

**Context / Problem statement:**
- SPEC-04 §4 e `backend-api-cross-link.md §1` reconciliaram o doc-05 DRAFT (byte stream) com o
  api-contract ratificado (§4.4 signed URL).
- `download()` é chamado só quando `podeBaixar === true`; a gate server-side §4.4 é defesa em profundidade.
- Re-fetch automático ao expirar/401/404 (uma vez, depois inline error) — SPEC-04 §4.
- Bloqueia: FE-PUB-009 (ExportFacade baixar), FE-PUB-010 (HistoryFacade baixar)

**Approach (execution path):**
1. Criar `libs/pub/data-access/src/lib/services/artifact-download.service.ts`:
   - `getSignedUrl(projetoId, publicacaoId): Observable<{arquivoUrl: string; expiresAt: string}>`
   - `download(projetoId, publicacaoId): void`:
     1. Chama getSignedUrl()
     2. Abre arquivoUrl em novo contexto de browser (window.open ou anchor target=_blank)
     3. On expiry/401/404: re-fetch fresh signed URL uma vez; se falhar novamente → emit AppError inline
2. Re-exportar via index.ts.

**Non-goals:**
- Não implementa streaming de bytes (definição de fora do escopo — api-contract §4.4).
- Não gerencia histórico de downloads.

**Layer(s):**
frontend / libs/pub/data-access

**Bounded context:**
pub

**Service execution spec(s):**
- `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-04-data-access.md` (§4)
- `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-07-error-handling.md` (§2 download URL expired)

**Architecture alignment:**
- Tag Nx: `scope:pub`, `type:data-access`
- Nunca expõe bytes; sempre URL assinada

**Implementation checklist (by file):**

**Lib: libs/pub/data-access**
- 🔲 `libs/pub/data-access/src/lib/services/artifact-download.service.ts`
- 🔲 `libs/pub/data-access/src/index.ts` (re-exports)

**Tests**
- 🔲 `nx test pub-data-access` PASS (getSignedUrl GET §4.4; download abre URL; re-fetch no 401)
- 🔲 `nx lint pub-data-access` PASS

**Milestone:**
Wave 2 / P2 Data Access

**Labels:**
type:feature
layer:frontend
scope:pub
priority:P2

**Acceptance criteria:**
- `npx nx test pub-data-access` PASS
- download() usa GET §4.4 fresco; nunca reusa URL além do TTL
- On 401 expirado: re-fetch automático uma vez; segunda falha → AppError inline
- ArtifactDownloadService nunca faz proxy de bytes

**Dependencies:**
- INT-FE-PUB-001 (interceptors, AppError)

**Data impact:**
- Nenhum

**API / Contract impact:**
- GET `/api/pub/projetos/{projetoId}/publicacoes/{publicacaoId}/download` (§4.4)

**Testing / Evidence required:**
- Spy em window.open confirma URL usada; HttpTestingController confirma re-fetch em 401

**Risks / Notes:**
- window.open pode ser bloqueado por popup blocker; testar via anchor com target=_blank como fallback.
