## [FE-IMP-023] Telemetria — import lifecycle events via pipeline event stream

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`ImpShellIntegrationService` publica eventos de lifecycle de importação no pipeline event stream
de `@cordele` (ou `@cordele/shared/observability` se disponível): import started, import succeeded,
import failed, structure confirmed.

**Context / Problem statement:**
- SPEC-06 §2 define que `ImpShellIntegrationService` "publishes import lifecycle breadcrumbs to the
  pipeline event stream (correlation id from the shared interceptor)".
- Os eventos incluem o `X-Correlation-Id` para correlação com o backend (D-423 observabilidade 360).
- Bloqueia: (nenhum — issue de observabilidade)

**Approach (execution path):**
1. Em `ImpShellIntegrationService.start()`: subscrever signals da `ImportFacade`:
   - `state === 'uploading'` → emit `{ event: 'imp.import.started', correlationId }`
   - `state === 'done'` → emit `{ event: 'imp.import.succeeded', manuscritoId, correlationId }`
   - `state === 'error'` → emit `{ event: 'imp.import.failed', errorType, correlationId }`
2. Em `ReviewFacade.confirmEstrutura()` (ou `ImpShellIntegrationService`): após sucesso →
   emit `{ event: 'imp.structure.confirmed', manuscritoId, projetoId }`.
3. Usar `@cordele/shared/observability` se existir; senão, usar `console.info` como stub
   (`TODO[lote-X]: replace stub with real telemetry service`).
4. `correlationId` vem do `X-Correlation-Id` injetado pelo interceptor compartilhado.

**Non-goals:**
- Não implementa o serviço de telemetria (pertence ao shared ou à infra).
- Não envia eventos ao backend diretamente (pipeline event stream é client-side).

**Layer(s):**
frontend / libs/imp/integration

**Bounded context:**
imp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/SPEC-06-shell-integration.md` (§2)

**Architecture alignment:**
- Tag Nx: `scope:imp`, `type:domain`

**Implementation checklist (by file):**

**Lib: libs/imp/integration**
- 🔲 `libs/imp/integration/src/lib/imp-shell-integration.service.ts` (lifecycle events)

**Tests**
- 🔲 `nx test imp-integration` PASS (import.started, import.succeeded, import.failed emitidos
  nos transitions corretas do ImportFacade)
- 🔲 `nx lint imp-integration` PASS

**Milestone:**
Wave 6 / P8 Observability

**Labels:**
type:feature
layer:frontend
scope:imp
priority:P8

**Acceptance criteria:**
- `npx nx test imp-integration` PASS
- `npx nx lint imp-integration` PASS
- `npx nx build imp-integration` PASS
- `imp.import.started` emitido quando upload começa
- `imp.structure.confirmed` emitido após confirm bem-sucedido

**Dependencies:**
- FE-IMP-010 (ImportFacade — subscriptions nos signals)
- INT-FE-IMP-006 (ImpShellIntegrationService base)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum

**Testing / Evidence required:**
- Spy no event emitter confirmando eventos nos transitions de estado

**Risks / Notes:**
- Se `@cordele/shared/observability` não existir ainda, usar stub com `console.info` e marcar com
  `TODO[lote-X]`.
