## [FE-IMP-002] Rotas do módulo IMP — imp.routes.ts / IMP_ROUTES

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/imp/shell-entry/src/lib/imp.routes.ts` exporta `IMP_ROUTES` com as quatro rotas do módulo
(redirect raiz + `/imp/upload` + `/imp/projetos/:projetoId/importar` +
`/imp/manuscritos/:manuscritoId/revisao`), cada uma com guards e `loadComponent` corretos.

**Context / Problem statement:**
- SPEC-01 §1 define a tabela mestra de rotas com guards, títulos e breadcrumb para cada path.
- A rota raiz `/imp` redireciona para `/imp/upload` (default landing).
- As duas rotas de upload mapeiam para `UploadComponent` (libs/imp/feature-upload), distinguidas
  por presença/ausência do `:projetoId`.
- A rota de revisão mapeia para `RevisaoDeEstruturaComponent` (libs/imp/feature-review).
- Bloqueia: FE-IMP-003, FE-IMP-013, FE-IMP-017

**Approach (execution path):**
1. Criar `libs/imp/shell-entry/src/lib/imp.routes.ts` exportando `IMP_ROUTES: Routes`.
2. Definir rota raiz com `redirectTo: 'upload'` e `pathMatch: 'full'`.
3. Rota `/upload`: `loadComponent` → `UploadComponent`, guards `[authGuard, empresaGuard,
   accessGuard('imp.import')]`, title `'Importar manuscrito'`.
4. Rota `/projetos/:projetoId/importar`: `loadComponent` → `UploadComponent`, guards `[authGuard,
   empresaGuard, accessGuard('imp.import'), impProjetoGuard]`, title `'Importar manuscrito'`.
5. Rota `/manuscritos/:manuscritoId/revisao`: `loadComponent` → `RevisaoDeEstruturaComponent`,
   guards `[authGuard, empresaGuard, accessGuard('imp.review')]`, title `'Revisão de estrutura'`.
6. Adicionar `data: { breadcrumb: ... }` a cada rota conforme SPEC-01 §1.

**Non-goals:**
- Não implementa os componentes (FE-IMP-013, FE-IMP-017).
- Não implementa `impProjetoGuard` em detalhes (FE-IMP-019).

**Layer(s):**
frontend / libs/imp/shell-entry

**Bounded context:**
imp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/SPEC-01-route-map.md` (§1, §2, §3)

**Architecture alignment:**
- `loadChildren` via `IMP_MODULE_DESCRIPTOR` — routes são lazy; `loadComponent` dentro da feature
- Tag Nx: `scope:imp`, `type:app`

**Implementation checklist (by file):**

**Lib: libs/imp/shell-entry**
- 🔲 `libs/imp/shell-entry/src/lib/imp.routes.ts` (IMP_ROUTES)
- 🔲 `libs/imp/shell-entry/src/index.ts` (re-export IMP_ROUTES)

**Tests**
- 🔲 `nx test imp-shell-entry` PASS (rotas têm guards esperados; redirect correto)
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
- Rota `/imp` redireciona para `/imp/upload`
- Rota `/imp/upload` tem guards `authGuard`, `empresaGuard`, `accessGuard('imp.import')`
- Rota `/imp/projetos/:projetoId/importar` tem adicionalmente `impProjetoGuard`
- Rota `/imp/manuscritos/:manuscritoId/revisao` tem `accessGuard('imp.review')`

**Dependencies:**
- FE-IMP-001 (MODULE_KEY e constantes de permissão)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum

**Testing / Evidence required:**
- Teste de rotas via `RouterTestingModule`

**Risks / Notes:**
- Confirmar que `accessGuard` aceita um parâmetro de permissão string (pattern do @cordele/shared).
- SPEC-01 §2 define a sequência de navegação — os `data.breadcrumb` devem ser compatíveis com o
  `NavigationService` (FE-IMP-020).
