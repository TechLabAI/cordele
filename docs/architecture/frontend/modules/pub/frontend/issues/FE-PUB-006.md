## [FE-PUB-006] PubShellIntegrationService — empresa subscription, nav registration, lifecycle breadcrumbs

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/pub/integration/src/lib/pub-shell-integration.service.ts` adapta PUB a serviços transversais
do Shell: registra nav contributions, assina EmpresaContext (empresa switch → cancela poll ativo),
e publica lifecycle breadcrumbs de publicação (export-requested, verdict-shown, downloaded).
Não injeta HttpClient nem mantém estado de negócio.

**Context / Problem statement:**
- SPEC-06 §2 define PubShellIntegrationService como glue puro: nav + empresa + breadcrumbs.
- Empresa switch deve cancelar o poll em andamento no ExportFacade (SPEC-06 §2, SPEC-04 §2).
- Lifecycle breadcrumbs correlacionam export-requested → verdict-shown → downloaded por projetoId.
- Bloqueia: FE-PUB-003 (bootstrap o injeta), FE-PUB-009 (ExportFacade usa empresaChanged signal)

**Approach (execution path):**
1. Criar `libs/pub/integration/src/lib/pub-shell-integration.service.ts`:
   - Injectable, sem HttpClient
   - `start()`: assina `EmpresaContext.activeEmpresa$`; emite `empresaChanged` signal quando muda
   - `stop()`: unsubscribe empresa; flush breadcrumbs pendentes
   - Expõe `empresaChanged: Signal<string | null>` para ExportFacade consumir
   - Método interno `publishBreadcrumb(event, projetoId)` (correlation id do interceptor shared)
2. `start()`/`stop()` chamados por pub.bootstrap (FE-PUB-003).

**Non-goals:**
- Não faz chamadas HTTP.
- Não mantém estado de publicação (responsabilidade das facades).

**Layer(s):**
frontend / libs/pub/integration

**Bounded context:**
pub ↔ shared (empresa-context, nav, observability)

**Service execution spec(s):**
- `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-06-shell-integration.md` (§2, §3)

**Architecture alignment:**
- Tag Nx: `scope:pub`, `type:domain`
- Sem HttpClient; sem estado de negócio

**Implementation checklist (by file):**

**Lib: libs/pub/integration**
- 🔲 `libs/pub/integration/src/lib/pub-shell-integration.service.ts`
- 🔲 `libs/pub/integration/src/index.ts`

**Tests**
- 🔲 `nx test pub-integration` PASS (stop() unsub empresa; empresaChanged emite no switch)
- 🔲 `nx lint pub-integration` PASS

**Milestone:**
Wave 1 / P1 Foundation

**Labels:**
type:feature
layer:frontend
scope:pub
priority:P1

**Acceptance criteria:**
- `npx nx test pub-integration` PASS
- `nx lint pub-integration` PASS
- stop() invocado: sem sub ativa de empresa
- PubShellIntegrationService não importa HttpClient

**Dependencies:**
- FE-PUB-001, FE-PUB-005

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum (só integração de shell)

**Testing / Evidence required:**
- Teste: empresa switch emite empresaChanged; stop() limpa sub

**Risks / Notes:**
- Confirmar que EmpresaContext de @cordele/shared/empresa-context expõe observable/signal de empresa ativa.
