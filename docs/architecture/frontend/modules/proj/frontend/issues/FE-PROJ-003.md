## [FE-PROJ-003] Module lifecycle — proj.module.ts, proj.bootstrap.ts

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/proj/shell-entry` expõe `projInit()` e `projDestroy()` que gerenciam o ciclo de vida do módulo PROJ.
`init()` registra a navegação via `ProjShellIntegrationService`; `destroy()` cancela requests in-flight
sem deixar estado cross-module residual (ADR-PROJ-001).

**Context / Problem statement:**
- SPEC-06 §3 define `proj.bootstrap.ts` com `projInit()` e `projDestroy()`.
- `projInit()` não pré-carrega dados (a biblioteca re-busca na entrada da rota — ADR-PROJ-001).
- `projDestroy()` cancela requests in-flight das duas facades; não há store compartilhada para teardown.
- Bloqueia: FE-PROJ-005 (ProjShellIntegrationService deve estar disponível antes do init)

**Approach (execution path):**
1. Criar `libs/proj/shell-entry/src/lib/proj.bootstrap.ts`:
   - `projInit()`: injeta `ProjShellIntegrationService` e chama `.register()`.
   - `projDestroy()`: injeta `LibraryFacade` e `HistoryFacade` e chama `.cancelInFlight()` em cada uma.
2. Criar `libs/proj/shell-entry/src/lib/proj.module.ts` (se necessário para compatibilidade com o shell
   que chama `ModuleWithProviders`; pode ser apenas funções se o shell suportar providers funcionais).
3. Garantir que `projInit` e `projDestroy` são exportados por `index.ts`.

**Non-goals:**
- Não pré-carrega lista de projetos (nenhuma chamada HTTP em `projInit`).
- Não gerencia estado cross-module (ADR-PROJ-001).

**Layer(s):**
frontend / libs/proj/shell-entry

**Bounded context:**
proj

**Service execution spec(s):**
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-06-shell-integration.md` (§3)

**Architecture alignment:**
- Tag Nx: `scope:proj`, `type:app`
- `projInit`/`projDestroy` são funções puras que operam via inject() — não são classes de serviço

**Implementation checklist (by file):**

**Lib: libs/proj/shell-entry**
- 🔲 `libs/proj/shell-entry/src/lib/proj.bootstrap.ts` (`projInit`, `projDestroy`)
- 🔲 `libs/proj/shell-entry/src/index.ts` (re-exports `projInit`, `projDestroy`)

**Tests**
- 🔲 `nx test proj-shell-entry` PASS — `projInit` chama `ProjShellIntegrationService.register()`
- 🔲 `nx test proj-shell-entry` PASS — `projDestroy` cancela requests das facades (spy)
- 🔲 `nx lint proj-shell-entry` PASS

**Milestone:**
Wave 1 / P1 Foundation

**Labels:**
type:feature
layer:frontend
scope:proj
priority:P1

**Acceptance criteria:**
- `npx nx test proj-shell-entry` PASS
- `npx nx lint proj-shell-entry` PASS
- `projInit()` não emite nenhuma chamada HTTP (verificado via `HttpTestingController.expectNone()`)
- `projDestroy()` cancela requests in-flight (verificado via spy nas facades)

**Dependencies:**
- FE-PROJ-001 (constantes)
- FE-PROJ-005 (ProjShellIntegrationService — pode ser stub para o teste de FE-PROJ-003)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum

**Testing / Evidence required:**
- Teste unitário com `TestBed.runInInjectionContext`

**Risks / Notes:**
- Se o shell do Cordelê usar `forRoot()` / `ModuleWithProviders`, adaptar a assinatura.
  Preferir funções funcionais (Angular 17+ standalone pattern).
