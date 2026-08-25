## [FE-COMP-002] comp.routes.ts — rotas parametrizadas por :projetoId

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/comp/shell-entry/src/lib/comp.routes.ts` define as rotas COMP parametrizadas por
`:projetoId`: `/projetos/:projetoId/config` e `/projetos/:projetoId/editor-de-layout-preview`,
ambas lazy (loadComponent), com os guards corretos e breadcrumb titles.

**Context / Problem statement:**
- SPEC-01 §1 define a tabela de rotas completa com guards, títulos e breadcrumbs.
- As rotas substituem as rotas flat do protótipo BA (`/config`, `/editor-de-layout-preview`)
  conforme D-J (rotas aninhadas 1:1 com o recurso `projetoId`).
- Guards obrigatórios: `authGuard`, `empresaGuard`, `accessGuard('comp.view')`,
  `compProjetoGuard`, `compStatusGuard` (SPEC-01 §3).
- Bloqueia: FE-COMP-011, FE-COMP-014

**Approach (execution path):**
1. Criar `comp.routes.ts` com `COMP_ROUTES: Route[]`.
2. Rota 1: path `projetos/:projetoId/config`, loadComponent → `ConfiguracoesComponent`, guards acima, title `{nome} · Configurar`.
3. Rota 2: path `projetos/:projetoId/editor-de-layout-preview`, loadComponent → `EditorDeLayoutPreviewComponent`, mesmos guards, title `{nome} · Edição`.
4. Registrar `COMP_ROUTES` em `COMP_MODULE_DESCRIPTOR` (FE-COMP-003) via `loadChildren`.
5. Garantir que sub-rotas são lazy (`loadComponent`); o módulo é carregado pelo shell via `@cordele/comp`.

**Non-goals:**
- Não implementa os componentes de página (FE-COMP-011, FE-COMP-014).
- Não implementa os guards novos (FE-COMP-019, FE-COMP-020).
- Não faz shell registration (FE-COMP-005).

**Layer(s):**
frontend / libs/comp/shell-entry

**Bounded context:**
comp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-01-route-map.md` (§1, §2, §3)

**Architecture alignment:**
- Tag Nx: `scope:comp`, `type:app`
- Lazy loading via `loadComponent` (standalone components)
- Guards importados de `@cordele/shared/access-decision` (auth/empresa/access) e `libs/comp/access` (comp*Guards)

**Implementation checklist (by file):**

**Lib: libs/comp/shell-entry**
- 🔲 `libs/comp/shell-entry/src/lib/comp.routes.ts`

**Tests**
- 🔲 `nx test comp-shell-entry` PASS (rotas têm os paths corretos e guards declarados)
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
- `npx nx build comp-shell-entry` PASS
- Rotas têm `:projetoId` e os 5 guards em ambas
- Protótipo flat routes não existem no resultado

**Dependencies:**
- FE-COMP-001 (MODULE_KEY e constantes)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum (routing apenas)

**Testing / Evidence required:**
- Teste de configuração das rotas (path, canActivate guards)

**Risks / Notes:**
- `compProjetoGuard` e `compStatusGuard` ainda não existem no shell; a rota pode ser declarada com imports de stub até FE-COMP-019/020 estarem prontos.
