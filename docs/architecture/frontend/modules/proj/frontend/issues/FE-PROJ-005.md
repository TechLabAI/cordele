## [FE-PROJ-005] Shell integration service — ProjShellIntegrationService

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/proj/integration` expõe `ProjShellIntegrationService` que registra `PROJ_NAV_CONFIG` com
`NavigationService` (breadcrumb templates + resolver stage-aware "Abrir") e emite breadcrumbs de
analytics via `@cordele/shared/observability`. O serviço não detém estado de UI.

**Context / Problem statement:**
- SPEC-06 §2 define `ProjShellIntegrationService.register()` como ponto de entrada para hooks cross-cutting.
- O resolver stage-aware ("Abrir" → `rascunho→IMP`, `em_composicao→COMP`, `publicado|com_erros→history`)
  vive em `libs/proj/navigation` e é referenciado pelo `PROJ_NAV_CONFIG` registrado aqui.
- Analytics breadcrumbs (library viewed, project opened, version downloaded) são emitidos via o hook
  de observabilidade compartilhado — sem bus de mensagens (doc 02 §5).
- Bloqueia: FE-PROJ-003 (projInit chama register())

**Approach (execution path):**
1. Criar `libs/proj/integration/src/lib/proj-shell-integration.service.ts`:
   - Injetar `NavigationService` de `@cordele/shared/access-decision`.
   - `register()` chama `this.nav.registerModuleNav(PROJ_NAV_CONFIG)` com breadcrumbs e resolver.
   - Emite evento de observabilidade `module_activated` via `@cordele/shared/observability` se disponível.
2. Criar `libs/proj/navigation/src/lib/proj-nav.config.ts` com `PROJ_NAV_CONFIG`:
   - Breadcrumb templates para as duas rotas.
   - Stage-aware resolver: `ProjetoStatus → targetRoute`.
3. Re-exportar via `index.ts` de cada lib.

**Non-goals:**
- Não detém lista de projetos nem estado de histórico (ADR-PROJ-001).
- Não implementa `projInit`/`projDestroy` (FE-PROJ-003).

**Layer(s):**
frontend / libs/proj/integration + libs/proj/navigation

**Bounded context:**
proj

**Service execution spec(s):**
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-06-shell-integration.md` (§2)
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-01-route-map.md` (§2)

**Architecture alignment:**
- Tag Nx: `scope:proj`, `type:domain` (integration e navigation)
- `libs/proj/integration` importa apenas `scope:proj` + `scope:shared`
- Não há NgRx nem observable store cross-module

**Implementation checklist (by file):**

**Lib: libs/proj/integration**
- 🔲 `libs/proj/integration/src/lib/proj-shell-integration.service.ts`
- 🔲 `libs/proj/integration/src/index.ts`

**Lib: libs/proj/navigation**
- 🔲 `libs/proj/navigation/src/lib/proj-nav.config.ts` (`PROJ_NAV_CONFIG`)
- 🔲 `libs/proj/navigation/src/lib/proj-stage-aware-resolver.ts` (status → route target)
- 🔲 `libs/proj/navigation/src/index.ts`

**Tests**
- 🔲 `nx test proj-integration` PASS — `register()` chama `NavigationService.registerModuleNav`
- 🔲 `nx test proj-navigation` PASS — resolver mapeia todos os 4 status corretamente
- 🔲 `nx lint proj-integration` PASS
- 🔲 `nx lint proj-navigation` PASS

**Milestone:**
Wave 1 / P1 Foundation

**Labels:**
type:feature
layer:frontend
scope:proj
priority:P1

**Acceptance criteria:**
- `npx nx test proj-integration` PASS
- `npx nx test proj-navigation` PASS
- `npx nx lint proj-integration` PASS
- Resolver: `rascunho → '/imp/upload'`, `em_composicao → '/comp/config'`, `publicado|com_erros → '/projetos/:id/historico'`
- `register()` não dispara nenhum HTTP request

**Dependencies:**
- FE-PROJ-001 (PROJ_NAV_CONFIG precisa das constantes de rota)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum

**Testing / Evidence required:**
- Spy em `NavigationService.registerModuleNav` verifica que é chamado com PROJ_NAV_CONFIG

**Risks / Notes:**
- Se `NavigationService.registerModuleNav` não existir no shared, criar stub/interface local e
  abrir tarefa para o time de plataforma.
- O resolver stage-aware deve cobrir os 4 status possíveis; status inexistente deve retornar a
  biblioteca como fallback seguro.
