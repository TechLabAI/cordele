## [FE-PUB-010] HistoryFacade — openHistory, download, newExport, adjustMetadata, backToLibrary

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/pub/data-access/src/lib/facades/history.facade.ts` carrega o cabeçalho do projeto,
metadados, lista de publicações e stats ao entrar em T08; expõe signals `.asReadonly()` para
DownloadEHistoricoComponent; delega download a ArtifactDownloadService; gerencia navegação de saída.

**Context / Problem statement:**
- SPEC-04 §1 e SPEC-03 §4 definem HistoryFacade (HistoryVM, PublicacaoVM[], PublicationStats).
- `openHistory(projetoId)`: chama getProjetoHeader + getAutor + listByProjeto + getStats em paralelo.
- versaoAtualId = publicacoes()[0]?.id (server-ordered newest-first, §4.3).
- Stats (PublicationStats §6.3) alimenta PublicationKpiRowComponent — 4 KPI tiles.
- `download(publicacaoId)`: só quando podeBaixar; delega a ArtifactDownloadService.
- Bloqueia: FE-PUB-018 (DownloadEHistoricoComponent consome este facade)

**Approach (execution path):**
1. Criar `libs/pub/data-access/src/lib/facades/history.facade.ts`:
   - Signals: status, projeto, meta, publicacoes, stats
   - Computed: versaoAtualId (publicacoes()[0]?.id)
   - `openHistory(projetoId)`: forkJoin([getProjetoHeader, getAutor, listByProjeto, getStats]) →
     popula signals; status loading → ready | empty | error
   - `download(publicacaoId)`: verifica podeBaixar; delega a ArtifactDownloadService
   - `newExport()`: navega T07 com projetoId
   - `adjustMetadata()`: navega PROJ reopen → COMP
   - `backToLibrary()`: navega PROJ biblioteca-de-projetos
   - `retry()`: re-chama openHistory()

**Non-goals:**
- Não gerencia o poll de exportação (FE-PUB-009).

**Layer(s):**
frontend / libs/pub/data-access

**Bounded context:**
pub

**Service execution spec(s):**
- `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-04-data-access.md` (§1, §5)
- `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-03-view-models.md` (§4)

**Architecture alignment:**
- Tag Nx: `scope:pub`, `type:data-access`
- Signals-first; computed versaoAtualId

**Implementation checklist (by file):**

**Lib: libs/pub/data-access**
- 🔲 `libs/pub/data-access/src/lib/facades/history.facade.ts`
- 🔲 `libs/pub/data-access/src/index.ts` (re-exports HistoryFacade)

**Tests**
- 🔲 `nx test pub-data-access` PASS (openHistory forkJoin; versaoAtualId=index0; empty state quando lista vazia)
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
- versaoAtualId === publicacoes()[0]?.id
- status 'empty' quando publicacoes.length === 0
- download(id) não chamado quando podeBaixar === false

**Dependencies:**
- FE-PUB-007 (PublicacaoApiService), FE-PUB-008 (ArtifactDownloadService)

**Data impact:**
- Nenhum (só leitura)

**API / Contract impact:**
- GET §4.3, §4.5, /api/proj (cross-context), COMP GetMetadados (cross-context)

**Testing / Evidence required:**
- Fake http: forkJoin resolve → signals populados corretamente

**Risks / Notes:**
- getProjetoHeader e getAutor cruzam contextos; confirmar que erros em um não bloqueiam o todo (use combineLatest ou forkJoin com catchError por stream).
