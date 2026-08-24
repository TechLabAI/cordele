## [FE-IMP-003] Module entry + bootstrap — ImpModule, imp.bootstrap.ts

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/imp/shell-entry` exporta `ImpModule` (barrel de entry que re-exporta rotas e contrato) e
`imp.bootstrap.ts` com `init()` / `destroy()` que registra/desregistra a navegação e integração
do módulo com o Shell.

**Context / Problem statement:**
- SPEC-06 §3 define `init()` e `destroy()` com assinaturas e responsabilidades exatas.
- `init()` registra `IMP_NAV_CONFIG` em `NavigationService` e inicializa `ImpShellIntegrationService`.
- `destroy()` desregistra nav contributions e cancela uploads em voo (empresa-switch safety).
- O `ImpShellIntegrationService` (lazy route injector) é GC'd pelo Angular com o route scope.
- Bloqueia: FE-IMP-005, INT-FE-IMP-006

**Approach (execution path):**
1. Criar `libs/imp/shell-entry/src/lib/imp.module.ts` (ou módulo standalone barrel) exportando
   `IMP_ROUTES` e re-exportando constantes públicas do contrato.
2. Criar `libs/imp/shell-entry/src/lib/imp.bootstrap.ts` com:
   - `init(ctx: ModuleBootstrapContext)`: chama `ctx.nav.register(IMP_NAV_CONFIG)`, inicia
     `ImpShellIntegrationService.start()`.
   - `destroy(ctx: ModuleBootstrapContext)`: chama `ctx.integration.stop()` e
     `ctx.nav.unregister(MODULE_KEY)`.
3. `IMP_NAV_CONFIG` pode ser um stub com `step: 1, label: 'Importar'` para esta issue;
   o config completo fica em FE-IMP-018.
4. Garantir que nenhum upload em voo sobreviva ao `destroy()` (cancelamento via subject no
   `ImpShellIntegrationService`).

**Non-goals:**
- Não implementa `ImpShellIntegrationService` completo (INT-FE-IMP-006).
- Não implementa `IMP_NAV_CONFIG` completo (FE-IMP-018).

**Layer(s):**
frontend / libs/imp/shell-entry

**Bounded context:**
imp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/SPEC-06-shell-integration.md` (§3)

**Architecture alignment:**
- Standalone + OnPush + Signals
- Tag Nx: `scope:imp`, `type:app`

**Implementation checklist (by file):**

**Lib: libs/imp/shell-entry**
- 🔲 `libs/imp/shell-entry/src/lib/imp.module.ts` (barrel / NgModule)
- 🔲 `libs/imp/shell-entry/src/lib/imp.bootstrap.ts` (init / destroy)
- 🔲 `libs/imp/shell-entry/src/index.ts` (re-exports ImpModule, init, destroy)

**Tests**
- 🔲 `nx test imp-shell-entry` PASS (init registra nav; destroy desregistra)
- 🔲 `nx lint imp-shell-entry` PASS

**Milestone:**
Wave 1 / P1 Foundation

**Labels:**
type:feature
layer:frontend
scope:imp
priority:P1

**Acceptance criteria:**
- `npx nx test imp-shell-entry` PASS
- `npx nx lint imp-shell-entry` PASS
- `npx nx build imp-shell-entry` PASS
- `init()` registra nav contributions via `ctx.nav.register`
- `destroy()` cancela upload em voo e remove nav contributions

**Dependencies:**
- FE-IMP-001 (MODULE_KEY)
- FE-IMP-002 (IMP_ROUTES)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum

**Testing / Evidence required:**
- Spy em `NavigationService.register` confirma chamada no `init`
- Spy em `NavigationService.unregister` confirma chamada no `destroy`

**Risks / Notes:**
- `ModuleBootstrapContext` interface deve ser compatível com o contrato do Shell (`@cordele/shared`).
  Verificar antes de implementar.
