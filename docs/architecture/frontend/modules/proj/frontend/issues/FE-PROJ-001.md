## [FE-PROJ-001] Module contract — proj.contract.ts, permission-map, feature-flags

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/proj/shell-entry/src/lib/` contém os quatro artefatos de contrato do módulo PROJ:
`proj.contract.ts`, `proj.permission-map.ts`, `proj.feature-flags.ts` e `proj.menu-metadata.ts`.
PROJ é o módulo home (`isHome: true`, `order: 0`). Shell e guards referenciam exclusivamente essas constantes.

**Context / Problem statement:**
- Ponto de partida obrigatório para toda a cadeia FE; sem o contrato, routes, guards, descriptor e
  shell registration não têm constantes para importar.
- SPEC-05 §1 define `MODULE_KEY`, `PROJ_MENU_METADATA`, `PROJ_PERMISSION_MAP`, `PROJ_FEATURE_FLAGS`.
- PROJ é o módulo home (`isHome: true`): o shell redireciona `''` → `/biblioteca-de-projetos` após login.
- Bloqueia: FE-PROJ-002, FE-PROJ-004, FE-PROJ-005, FE-PROJ-017, FE-PROJ-018

**Approach (execution path):**
1. Criar `libs/proj/shell-entry/src/lib/proj.contract.ts` com `MODULE_KEY = 'proj'` e `PROJ_MENU_METADATA`
   (label `Projetos`, icon `library_books`, order 0, isHome true, route `/biblioteca-de-projetos`).
2. Criar `proj.permission-map.ts` com `PROJ_PERMISSION_MAP`:
   - `proj.view` → `{ beScope: 'proj:read' }` (rota base; toda tela PROJ)
   - `proj.download` → `{ beScope: 'proj:read' }` (affordance Baixar / quick-download)
   - `proj.reopen` → `{ beScope: 'proj:write' }` (CTAs T08 Ajustar metadados/layout)
   - `proj.delete` reservado (comentado; beScope `proj:delete`; sem UI no MVP)
3. Criar `proj.feature-flags.ts` com `PROJ_FEATURE_FLAGS`:
   - `proj.quickDownload` defaultState `on`
   - `proj.reopen` defaultState `on`
4. Re-exportar tudo via `index.ts` da lib.
5. Reutilizar tipos `ModuleMenuMetadata`, `ModulePermissionMap`, `ModuleFeatureFlags` de `@cordele/shared`
   se existirem; caso contrário, definir localmente e abrir PR para `shared`.

**Non-goals:**
- Não implementa descriptor nem bootstrap (FE-PROJ-004).
- Não registra no shell (FE-PROJ-006).

**Layer(s):**
frontend / libs/proj/shell-entry

**Bounded context:**
proj

**Service execution spec(s):**
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-05-tool-contract.md` (§1, §2, §3)

**Architecture alignment:**
- Standalone + OnPush + Signals (não se aplica a constantes puras)
- Tag Nx: `scope:proj`, `type:app` (shell-entry)
- Nenhum componente testa roles diretamente — só `AccessDecisionService`
- `proj.delete` reservado sem affordance de UI (erasure LGPD deferido — SPEC-05 §2)

**Implementation checklist (by file):**

**Lib: libs/proj/shell-entry**
- 🔲 `libs/proj/shell-entry/src/lib/proj.contract.ts`
- 🔲 `libs/proj/shell-entry/src/lib/proj.permission-map.ts`
- 🔲 `libs/proj/shell-entry/src/lib/proj.feature-flags.ts`
- 🔲 `libs/proj/shell-entry/src/index.ts` (re-exports)

**Tests**
- 🔲 `nx test proj-shell-entry` PASS (Jest unit — constantes exportadas têm os valores esperados)
- 🔲 `nx lint proj-shell-entry` PASS (boundaries + ESLint)

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
- `npx nx build proj-shell-entry` PASS (sem erros)
- `PROJ_PERMISSION_MAP` contém exatamente `proj.view`, `proj.download`, `proj.reopen`
- `PROJ_FEATURE_FLAGS` contém exatamente `proj.quickDownload`, `proj.reopen`
- `PROJ_MENU_METADATA.isHome === true` e `order === 0`

**Dependencies:**
- (nenhuma — issue inaugural)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum (só constantes de configuração)

**Testing / Evidence required:**
- Teste unitário valida shape dos objetos exportados e que `isHome: true`

**Risks / Notes:**
- Verificar se `ModuleMenuMetadata` / `ModulePermissionMap` / `ModuleFeatureFlags` já existem em
  `@cordele/shared`; evitar redefinição duplicada.
- `proj.delete` deve ficar comentado mas presente para que o dev de LGPD saiba a intenção.
