## [INT-FE-IMP-005] Integração EmpresaContext — cancelamento de upload em troca de empresa

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
Quando o usuário troca de empresa durante um upload em voo, `ImportFacade` cancela a subscription
HTTP e `ReviewFacade` NÃO hidrata com o response tardio. O estado volta a `idle`.

**Context / Problem statement:**
- SPEC-04 §2 e SPEC-06 §2 definem que `ImpShellIntegrationService` subscreve `EmpresaContext`
  e expõe um signal `empresaChanged` que `ImportFacade` usa para cancelar uploads.
- Critério EARS `imp-empresa-cancel`: "WHEN the active empresa changes during an in-flight upload,
  THE SYSTEM SHALL cancel the request".
- O `takeUntil(empresaChanged$)` garante que nenhum request de uma empresa anterior chega ao
  facade de outra empresa.

**Context / Approach:**
1. `ImpShellIntegrationService.empresaChanged$`: `Observable<void>` que emite quando
   `EmpresaContext.activeEmpresa` muda.
2. `ImportFacade.submit()`: pipe com `takeUntil(this.shellIntegration.empresaChanged$)`.
3. Em `ImpShellIntegrationService.start()`: subscrever `EmpresaContext.activeEmpresa$` →
   subject.next() no change.
4. `destroy()` em `imp.bootstrap.ts` deve completar o subject.
5. Teste: simular empresa-switch durante upload → HttpTestingController.verify: request cancelado;
   facade state → 'idle' ou 'error'.

**Non-goals:**
- Não implementa `EmpresaContext` (pertence a `@cordele/shared/empresa-context`).

**Layer(s):**
frontend / libs/imp/integration, libs/imp/data-access

**Bounded context:**
imp (cross-cutting tenant isolation)

**Service execution spec(s):**
- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/SPEC-04-data-access.md` (§2)
- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/SPEC-06-shell-integration.md` (§2, §3)

**Architecture alignment:**
- Tag Nx: `scope:imp`, `type:domain`

**Implementation checklist (by file):**

**Lib: libs/imp/integration**
- 🔲 `ImpShellIntegrationService`: `empresaChanged$` subject + subscription a `EmpresaContext`

**Lib: libs/imp/data-access**
- 🔲 `ImportFacade.submit()`: `takeUntil(empresaChanged$)`

**Tests**
- 🔲 `nx test imp-integration` PASS (empresa-switch → upload cancelado)
- 🔲 `nx lint imp-integration` PASS

**Milestone:**
Wave 3 / P4 Integrações

**Labels:**
type:integration
layer:frontend
scope:imp
priority:P4

**Acceptance criteria:**
- Empresa-switch durante upload → request cancelado + state não avança para 'done'
- Nenhum response tardio de empresa anterior popula facade da empresa nova

**Dependencies:**
- FE-IMP-010 (ImportFacade)
- FE-IMP-003 (imp.bootstrap.ts — destroy cancela subject)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum

**Testing / Evidence required:**
- Teste com `HttpTestingController` + `fakeAsync`: empresa-switch → request.flush → state='idle'

**Risks / Notes:**
- `EmpresaContext.activeEmpresa$` pode ser um `Signal` (não Observable) dependendo da implementação
  do shared; usar `toObservable()` do Angular signals se necessário.
