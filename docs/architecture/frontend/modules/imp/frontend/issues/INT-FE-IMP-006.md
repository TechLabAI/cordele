## [INT-FE-IMP-006] Integração NavigationService — registro de nav contributions (step-bar + breadcrumb)

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`ImpShellIntegrationService` registra e desregistra corretamente as contribuições de navegação
de IMP (step-bar step 1 + breadcrumb roots) via `NavigationService` do Shell.

**Context / Problem statement:**
- SPEC-06 §2 e §3 definem que `ImpShellIntegrationService.start()` registra `IMP_NAV_CONFIG` e
  `destroy()` desregistra via `NavigationService.unregister(MODULE_KEY)`.
- A barra de 4 passos é montada pelo Shell a partir das contribuições de cada módulo — IMP contribui
  apenas o step 1 "Importar".
- Sem este registro, a barra de steps fica incompleta.

**Context / Approach:**
1. Criar `libs/imp/integration/src/lib/imp-shell-integration.service.ts` (se ainda não existir):
   - `inject(NavigationService)` de `@cordele/shared/access-decision`
   - `start()`: `this.nav.register(IMP_NAV_CONFIG)`
   - `stop()`: `this.nav.unregister(MODULE_KEY)`
2. Verificar que `destroy()` em `imp.bootstrap.ts` chama `service.stop()`.
3. Confirmar que `NavigationService.register` aceita `IMP_NAV_CONFIG` shape.
4. Teste: `start()` → `NavigationService.register` chamado com `{ stepIndex: 1, label: 'Importar' }`;
   `stop()` → `NavigationService.unregister('imp')` chamado.

**Non-goals:**
- Não implementa `NavigationService` (pertence a `@cordele/shared`).
- Não implementa `StepBarComponent` UI (FE-IMP-018).

**Layer(s):**
frontend / libs/imp/integration

**Bounded context:**
imp (shell integration)

**Service execution spec(s):**
- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/SPEC-06-shell-integration.md` (§2, §3)

**Architecture alignment:**
- Tag Nx: `scope:imp`, `type:domain`

**Implementation checklist (by file):**

**Lib: libs/imp/integration**
- 🔲 `libs/imp/integration/src/lib/imp-shell-integration.service.ts` (start/stop nav)
- 🔲 `libs/imp/integration/src/index.ts` (re-export)

**Tests**
- 🔲 `nx test imp-integration` PASS (start → register; stop → unregister)
- 🔲 `nx lint imp-integration` PASS

**Milestone:**
Wave 1 / P4 Integrações

**Labels:**
type:integration
layer:frontend
scope:imp
priority:P4

**Acceptance criteria:**
- `nx test imp-integration` PASS
- `nx lint imp-integration` PASS
- `NavigationService.register` chamado com step 1 de IMP no `start()`
- `NavigationService.unregister('imp')` chamado no `stop()`

**Dependencies:**
- FE-IMP-003 (imp.bootstrap.ts usa este serviço)
- FE-IMP-018 (IMP_NAV_CONFIG)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum

**Testing / Evidence required:**
- Spy em NavigationService (mock) confirmando calls corretos

**Risks / Notes:**
- Se `NavigationService` ainda não tiver o método `register/unregister` no shared, criar stub
  e marcar com `TODO[lote-X]: wire real NavigationService when available`.
