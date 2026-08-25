## [FE-PROJ-002] Module routes — proj.routes.ts, lazy loading por feature

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`apps/cordele-web/src/app/proj-module/proj.routes.ts` (ou `libs/proj/shell-entry`) define as duas rotas
lazy-loaded: `/biblioteca-de-projetos` e `/projetos/:projetoId/historico`. O shell carrega `@cordele/proj`
via `loadChildren`; cada tela é `loadComponent` dentro de `proj.routes.ts`.

**Context / Problem statement:**
- SPEC-01 §1 define a tabela mestre de rotas: 2 rotas, 2 feature libs, guards distintos.
- A rota T08 é parametrizada por `:projetoId` (decisão M3: rota plana `/download-e-historico` do
  protótipo é substituída em Promote — SPEC-01 §1 nota).
- `projProjetoGuard` protege apenas a rota T08 (não a biblioteca).
- Bloqueia: FE-PROJ-003, FE-PROJ-012, FE-PROJ-014

**Approach (execution path):**
1. Criar `proj.routes.ts` com `Routes`:
   ```
   { path: 'biblioteca-de-projetos', loadComponent: () => BibliotecaDeProjetosComponent, guards: [authGuard, empresaGuard, accessGuard('proj.view')], title: 'Projetos', data: { breadcrumb: [...] } }
   { path: 'projetos/:projetoId/historico', loadComponent: () => DownloadEHistoricoComponent, guards: [..., projProjetoGuard], title: ... }
   { path: '', redirectTo: 'biblioteca-de-projetos', pathMatch: 'full' }
   ```
2. Registrar `PROJ_ROUTES` como `PROJ_MODULE_DESCRIPTOR.loadChildren` (ver FE-PROJ-004).
3. Adicionar dados de breadcrumb no `data` das rotas para uso pelo `ProjShellIntegrationService`.

**Non-goals:**
- Não implementa guards (FE-PROJ-017 para `projProjetoGuard`).
- Não implementa os componentes (FE-PROJ-012, FE-PROJ-014).

**Layer(s):**
frontend / libs/proj/shell-entry (routes) + apps/cordele-web (shell loadChildren)

**Bounded context:**
proj

**Service execution spec(s):**
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-01-route-map.md` (§1, §3)

**Architecture alignment:**
- Tag Nx: `scope:proj`, `type:app`
- Cada rota é `loadComponent` (standalone-first, sem NgModule lazy chunk)
- Guard order: `authGuard` → `empresaGuard` → `accessGuard('proj.view')` → `projProjetoGuard` (só T08)

**Implementation checklist (by file):**

**Lib / App entry**
- 🔲 `libs/proj/shell-entry/src/lib/proj.routes.ts`
- 🔲 `libs/proj/shell-entry/src/index.ts` (exporta `PROJ_ROUTES`)
- 🔲 `apps/cordele-web/src/app/app.routes.ts` (ou `module-descriptors.ts`) — adiciona loadChildren para `@cordele/proj`

**Tests**
- 🔲 `nx test proj-shell-entry` PASS (rota `/biblioteca-de-projetos` existe e redireciona `''`)
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
- Navegar para `/` após login redireciona para `/biblioteca-de-projetos`
- URL `/projetos/uuid/historico` resolve o componente correto com `:projetoId` no param

**Dependencies:**
- FE-PROJ-001 (constantes de permissão para o `accessGuard`)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum

**Testing / Evidence required:**
- Teste de rotas (RouterTestingHarness) verifica redirect `''` → biblioteca

**Risks / Notes:**
- A rota plana `/download-e-historico` do protótipo deve ser **removida** ao Promote; não criar alias.
- `projProjetoGuard` (FE-PROJ-017) pode ser stub nesta issue e completado depois.
