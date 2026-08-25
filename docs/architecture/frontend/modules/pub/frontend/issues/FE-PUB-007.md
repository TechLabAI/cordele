## [FE-PUB-007] PublicacaoApiService — trigger, getStatus, listByProjeto, getStats, getProjetoHeader, getAutor + DTOs

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/pub/data-access/src/lib/services/publicacao-api.service.ts` implementa todas as operações de
leitura/criação de publicações sobre `HttpClient` wrappado por `@cordele/shared/access-http-base`.
DTOs em `libs/pub/data-access/src/lib/models/` replicam estruturalmente os schemas de `api-contract.md §6`.

**Context / Problem statement:**
- SPEC-04 §1 e `contracts/backend-api-cross-link.md §1` definem os 7 endpoints consumidos por PUB.
- Nenhum componente chama HttpClient — toda I/O passa por este service e pelas facades.
- `trigger()`: POST §4.1 (body vazio, 202 novo / 200 em andamento idempotente).
- `getStatus()`: GET §4.2 — poll target; retorna body + Retry-After header.
- `listByProjeto()`: GET §4.3 newest-first.
- `getStats()`: GET §4.5 live projection.
- `getProjetoHeader()`: GET /api/proj/projetos/{projetoId} (cross-context, PROJ).
- `getAutor()`: GET COMP GetMetadados (cross-context, COMP).
- Bloqueia: FE-PUB-009 (ExportFacade), FE-PUB-010 (HistoryFacade)

**Approach (execution path):**
1. Criar `libs/pub/data-access/src/lib/models/`:
   - `publicacao-status.model.ts` (PublicacaoStatus, BuildStatus, EpubcheckStatus)
   - `publicacao-history-item.model.ts` (PublicacaoHistoryItem)
   - `publication-stats.model.ts` (PublicationStats — §6.3)
2. Criar `libs/pub/data-access/src/lib/services/publicacao-api.service.ts`:
   - `trigger(projetoId)`: POST, captura Location header, retorna PublicacaoStatus
   - `getStatus(projetoId, publicacaoId)`: GET, extrai Retry-After header
   - `listByProjeto(projetoId)`: GET list
   - `getStats(projetoId)`: GET stats
   - `getProjetoHeader(projetoId)`: GET cross-context PROJ
   - `getAutor(projetoId)`: GET cross-context COMP
3. Re-exportar via `libs/pub/data-access/src/index.ts`.

**Non-goals:**
- Não implementa ArtifactDownloadService (FE-PUB-008).
- Não implementa facades (FE-PUB-009, FE-PUB-010).
- Não implementa error mapping (FE-PUB-011).

**Layer(s):**
frontend / libs/pub/data-access

**Bounded context:**
pub

**Service execution spec(s):**
- `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-04-data-access.md` (§1, §2, §3)
- `docs/architecture/frontend/modules/pub/frontend/contracts/backend-api-cross-link.md` (§1, §3)

**Architecture alignment:**
- Tag Nx: `scope:pub`, `type:data-access`
- HttpClient wrappado pelo shared interceptor; componentes nunca injetam HttpClient

**Implementation checklist (by file):**

**Lib: libs/pub/data-access**
- 🔲 `libs/pub/data-access/src/lib/models/publicacao-status.model.ts`
- 🔲 `libs/pub/data-access/src/lib/models/publicacao-history-item.model.ts`
- 🔲 `libs/pub/data-access/src/lib/models/publication-stats.model.ts`
- 🔲 `libs/pub/data-access/src/lib/services/publicacao-api.service.ts`
- 🔲 `libs/pub/data-access/src/index.ts`

**Tests**
- 🔲 `nx test pub-data-access` PASS (HttpTestingController; trigger POST 202; getStatus extrai Retry-After)
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
- `npx nx lint pub-data-access` PASS
- trigger() POST body vazio; retorna PublicacaoStatus com publicacaoId
- getStatus() retorna retryAfterMs extraído de Retry-After header (null se ausente)
- Nenhum componente injeta HttpClient diretamente

**Dependencies:**
- FE-PUB-001 (MODULE_KEY)
- INT-FE-PUB-001 (access-http-base interceptors)
- INT-FE-PUB-002 (cross-context PROJ), INT-FE-PUB-003 (cross-context COMP)

**Data impact:**
- Nenhum client-side além de session storage de auth

**API / Contract impact:**
- Todos os endpoints de `api-contract.md §4.*`; DTOs devem ser structurally compatible com §6

**Testing / Evidence required:**
- HttpTestingController confirma URL, método e body de cada operação

**Risks / Notes:**
- getProjetoHeader e getAutor cruzam contexto de módulos; confirmar base URLs antes do scaffold.
- trigger() body vazio — não enviar JSON payload.
