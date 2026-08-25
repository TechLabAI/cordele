## [FE-COMP-003] COMP_MODULE_DESCRIPTOR + comp.bootstrap.ts

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/comp/shell-entry/src/lib/` contém `COMP_MODULE_DESCRIPTOR` (descritor estático para o
shell) e `comp.bootstrap.ts` com `compInit()` / `compDestroy()`. O init registra a nav config
via `CompShellIntegrationService`; o destroy cancela requests em voo e não deixa estado
cross-module residual.

**Context / Problem statement:**
- SPEC-05 §4 e SPEC-06 §3 definem o descriptor e o ciclo de vida bootstrap.
- O shell usa `COMP_MODULE_DESCRIPTOR` para lazy-load `@cordele/comp` e posicionar o step-bar
  sem hard-code de label/icon.
- `compInit()` não faz prefetch de dados (ADR-COMP-001); só registra navegação (SPEC-06 §3).
- Bloqueia: FE-COMP-005 (shell registration)

**Approach (execution path):**
1. Criar `comp.bootstrap.ts` com:
   - `compInit()`: `inject(CompShellIntegrationService).register()`
   - `compDestroy()`: cancela requests in-flight (sinalizado pelas facades via `takeUntilDestroyed`)
2. Criar `COMP_MODULE_DESCRIPTOR` em `comp.contract.ts` (ou arquivo dedicado):
   ```ts
   { key: MODULE_KEY, menu: COMP_MENU_METADATA, permissions: COMP_PERMISSION_MAP,
     flags: COMP_FEATURE_FLAGS, loadChildren: () => import('@cordele/comp').then(m => m.CompModule) }
   ```
3. Re-exportar via `index.ts`.

**Non-goals:**
- Não implementa `CompShellIntegrationService` (FE-COMP-004).
- Não registra no shell (FE-COMP-005).
- Não faz prefetch de dados.

**Layer(s):**
frontend / libs/comp/shell-entry

**Bounded context:**
comp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-05-tool-contract.md` (§4)
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-06-shell-integration.md` (§3)

**Architecture alignment:**
- Tag Nx: `scope:comp`, `type:app`
- Sem prefetch; cada tela faz GET na entrada (ADR-COMP-001)

**Implementation checklist (by file):**

**Lib: libs/comp/shell-entry**
- 🔲 `libs/comp/shell-entry/src/lib/comp.bootstrap.ts`
- 🔲 `libs/comp/shell-entry/src/lib/comp.contract.ts` (COMP_MODULE_DESCRIPTOR adicionado)
- 🔲 `libs/comp/shell-entry/src/index.ts` (re-exports)

**Tests**
- 🔲 `nx test comp-shell-entry` PASS
- 🔲 `nx lint comp-shell-entry` PASS

**Milestone:**
Wave 1 / P1 Foundation

**Labels:**
type:feature
layer:frontend
scope:comp
priority:P1

**Acceptance criteria:**
- `npx nx test comp-shell-entry` PASS
- `npx nx lint comp-shell-entry` PASS
- `compInit()` chama `CompShellIntegrationService.register()` sem prefetch de dados
- `COMP_MODULE_DESCRIPTOR.loadChildren` aponta para `@cordele/comp`

**Dependencies:**
- FE-COMP-001 (constantes), FE-COMP-004 (CompShellIntegrationService — pode ser stub no init)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum

**Testing / Evidence required:**
- Teste de que `compInit()` não emite chamadas HTTP (spy em HttpClient)

**Risks / Notes:**
- Confirmar que o shell (apps/cordele-web) usa `ModuleDescriptor.loadChildren` para lazy-load; se o padrão for diferente, alinhar com FE-COMP-005.
