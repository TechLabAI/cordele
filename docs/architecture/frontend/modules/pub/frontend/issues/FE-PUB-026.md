## [FE-PUB-026] Telemetria — eventos export-requested, verdict-shown, downloaded

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
PubShellIntegrationService publica lifecycle breadcrumbs de publicação para o pipeline de
observabilidade do Shell: `export-requested` (disparo do POST), `verdict-shown` (fase terminal
renderizada), `downloaded` (signed URL aberta). Cada evento carrega `projetoId` e `correlationId`.

**Context / Problem statement:**
- SPEC-06 §2: PubShellIntegrationService publica breadcrumbs de lifecycle.
- Correlação: `X-Correlation-Id` do interceptor shared é o correlationId de cada evento.
- Sem telemetria de negócio antes desta issue (breadcrumbs são dados de observabilidade do pipeline).

**Approach (execution path):**
1. Completar `publishBreadcrumb(event, projetoId)` em PubShellIntegrationService (FE-PUB-006):
   - Emitir evento via @cordele/shared/observability (se disponível) ou logar com correlationId
   - Eventos: 'export-requested', 'verdict-shown', 'downloaded'
2. ExportFacade (FE-PUB-009): chamar publishBreadcrumb nos momentos corretos.
3. ArtifactDownloadService (FE-PUB-008): chamar publishBreadcrumb 'downloaded' ao abrir URL.

**Non-goals:**
- Não implementa analytics de produto (fora do escopo MVP).

**Layer(s):**
frontend / libs/pub/integration + libs/pub/data-access

**Bounded context:**
pub ↔ observability

**Service execution spec(s):**
- `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-06-shell-integration.md` (§2)

**Architecture alignment:**
- Tag Nx: `scope:pub`, `type:domain`

**Implementation checklist (by file):**

**Lib: libs/pub/integration**
- 🔲 `publishBreadcrumb(event, projetoId)` em pub-shell-integration.service.ts
- 🔲 Wiring em ExportFacade e ArtifactDownloadService

**Tests**
- 🔲 `nx test pub-integration` PASS (export-requested emitido no trigger; verdict-shown no terminal)
- 🔲 `nx lint pub-integration` PASS

**Milestone:**
Wave 8 / P8 Observability

**Labels:**
type:feature
layer:frontend
scope:pub
priority:P8

**Acceptance criteria:**
- export-requested: emitido no POST trigger
- verdict-shown: emitido quando fase terminal renderizada
- downloaded: emitido ao abrir signed URL
- correlationId presente em cada evento

**Dependencies:**
- FE-PUB-006, FE-PUB-009, FE-PUB-008

**Data impact:**
- Nenhum (observabilidade apenas)

**API / Contract impact:**
- Nenhum

**Testing / Evidence required:**
- Spy em publishBreadcrumb: eventos na ordem correta

**Risks / Notes:**
- Confirmar que @cordele/shared/observability ou equivalente existe; se não, logar apenas com correlationId.
