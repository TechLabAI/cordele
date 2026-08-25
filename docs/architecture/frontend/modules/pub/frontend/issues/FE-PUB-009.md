## [FE-PUB-009] ExportFacade — state machine, bounded poll, Retry-After, requestExport, resumeExport

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/pub/data-access/src/lib/facades/export.facade.ts` implementa a máquina de estados de exportação
(gerando → valido | erros | error), poll limitado com Retry-After, resume on re-entry e cancellation
on navigate-away ou empresa switch. Expõe signals `.asReadonly()` para ExportacaoEValidacaoComponent.

**Context / Problem statement:**
- SPEC-04 §2 define o ExportFacade state machine e o bounded poll (POST 202 + GET status, Retry-After).
- SPEC-03 §1 mapeia build status + epubcheckStatus → ExportPhase (gerando/valido/erros/error).
- `requestExport(projetoId)`: dispara POST §4.1; captura publicacaoId; inicia poll.
- `resumeExport(projetoId)`: on re-entry sem estado in-memory; lê listByProjeto §4.3 newest-first;
  se non-terminal → retoma poll; senão renderiza terminal diretamente.
- Poll: honra Retry-After; bounded (max attempts + max duration); no exhaustion → honest timeout state.
- Cancellation: empresa switch (empresaChanged de PubShellIntegrationService) + navigate-away.
- Bloqueia: FE-PUB-012 (ExportacaoEValidacaoComponent consome este facade)

**Approach (execution path):**
1. Criar `libs/pub/data-access/src/lib/facades/export.facade.ts`:
   - Signals: projetoId, phase, buildStatus, publicacao, summary, avisos
   - Computed: verdict, podeBaixar, totalErros, totalAvisos, resumoErro
   - `requestExport(projetoId)`: POST §4.1 → publicacaoId → startPoll()
   - `resumeExport(projetoId)`: listByProjeto() → index 0 → in-flight? startPoll : renderTerminal()
   - `startPoll(projetoId, publicacaoId)`: RxJS interval honrando retryAfterMs, max 60 tentativas / 5min
   - `stopPoll()`: unsubscribe; chamado em navigate-away e empresa switch
   - `retry()`: se terminal com error → getStatus(); não re-dispara POST
   - `baixar(publicacaoId)`: só se podeBaixar; chama ArtifactDownloadService
   - `adjustLayout()`: navega para COMP
2. Assina PubShellIntegrationService.empresaChanged → stopPoll().

**Non-goals:**
- Não renderiza UI (responsabilidade de ExportacaoEValidacaoComponent).
- Não implementa HistoryFacade (FE-PUB-010).

**Layer(s):**
frontend / libs/pub/data-access

**Bounded context:**
pub

**Service execution spec(s):**
- `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-04-data-access.md` (§2, §3)
- `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-03-view-models.md` (§1)

**Architecture alignment:**
- Tag Nx: `scope:pub`, `type:data-access`
- Signals-first (sem NgRx); computed() para podeBaixar/verdict

**Implementation checklist (by file):**

**Lib: libs/pub/data-access**
- 🔲 `libs/pub/data-access/src/lib/facades/export.facade.ts`
- 🔲 `libs/pub/data-access/src/index.ts` (re-exports ExportFacade)

**Tests**
- 🔲 `nx test pub-data-access` PASS (state machine: POST→gerando→valido; resumeExport; empresa switch cancela)
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
- Poll para após status terminal (publicado / com_erros)
- podeBaixar computed: true iff epubcheckStatus∈{valido,avisos} && arquivoDisponivel
- empresa switch → stopPoll() chamado
- retry() não re-dispara POST

**Dependencies:**
- FE-PUB-007 (PublicacaoApiService), FE-PUB-008 (ArtifactDownloadService), FE-PUB-006 (empresaChanged)

**Data impact:**
- Estado efêmero in-memory (signals); descartado ao navegar de T07

**API / Contract impact:**
- POST §4.1 (trigger), GET §4.2 (poll), GET §4.3 (resume), GET §4.4 (download)

**Testing / Evidence required:**
- Fake timer: poll dispara N vezes honrando retryAfterMs; para no terminal
- Spy: empresa switch → stopPoll

**Risks / Notes:**
- Sem SSE, sem long-request (ADR-PUB-001, D-N). Poll com Retry-After é o único mecanismo.
- Max attempts / max duration: valores default recomendados 60 tentativas / 300 segundos.
