## [FE-PROJ-004] Module descriptor — PROJ_MODULE_DESCRIPTOR

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/proj/shell-entry` exporta `PROJ_MODULE_DESCRIPTOR` completo (key, menu, permissions, flags,
loadChildren). O descriptor é a única interface entre o shell e o módulo PROJ — o shell nunca importa
libs de feature diretamente.

**Context / Problem statement:**
- SPEC-05 §4 define a forma de `PROJ_MODULE_DESCRIPTOR`.
- PROJ é o módulo home (`isHome: true`) — o shell usa o descriptor para montar o redirect pós-login.
- O descriptor consolida `PROJ_MENU_METADATA`, `PROJ_PERMISSION_MAP`, `PROJ_FEATURE_FLAGS` e o
  `loadChildren` lazy para `@cordele/proj`.
- Bloqueia: FE-PROJ-006 (shell usa o descriptor para registro)

**Approach (execution path):**
1. Criar `libs/proj/shell-entry/src/lib/proj.descriptor.ts`:
   ```ts
   export const PROJ_MODULE_DESCRIPTOR: ModuleDescriptor = {
     key: MODULE_KEY,
     menu: PROJ_MENU_METADATA,
     permissions: PROJ_PERMISSION_MAP,
     flags: PROJ_FEATURE_FLAGS,
     loadChildren: () => import('./proj.routes').then(m => m.PROJ_ROUTES),
   };
   ```
2. Re-exportar via `index.ts` da lib.
3. Verificar tipo `ModuleDescriptor` em `@cordele/shared`; se não existir, definir localmente.

**Non-goals:**
- Não registra o descriptor no shell (FE-PROJ-006).
- Não implementa o bootstrap lifecycle (FE-PROJ-003).

**Layer(s):**
frontend / libs/proj/shell-entry

**Bounded context:**
proj

**Service execution spec(s):**
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-05-tool-contract.md` (§4)
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-06-shell-integration.md` (§1)

**Architecture alignment:**
- Tag Nx: `scope:proj`, `type:app`
- O shell acessa PROJ apenas via `@cordele/proj` (importPath da lib shell-entry) e o descriptor

**Implementation checklist (by file):**

**Lib: libs/proj/shell-entry**
- 🔲 `libs/proj/shell-entry/src/lib/proj.descriptor.ts`
- 🔲 `libs/proj/shell-entry/src/index.ts` (exporta `PROJ_MODULE_DESCRIPTOR`)

**Tests**
- 🔲 `nx test proj-shell-entry` PASS — descriptor tem `key === 'proj'`, `menu.isHome === true`
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
- `PROJ_MODULE_DESCRIPTOR.menu.isHome === true`
- `PROJ_MODULE_DESCRIPTOR.key === 'proj'`

**Dependencies:**
- FE-PROJ-001 (constantes de contrato)
- FE-PROJ-002 (PROJ_ROUTES para o loadChildren)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum

**Testing / Evidence required:**
- Teste unitário valida shape do descriptor

**Risks / Notes:**
- Verificar se `ModuleDescriptor` tem campo `init`/`destroy` para plugar `projInit`/`projDestroy`;
  se sim, adicionar aqui e remover a responsabilidade de FE-PROJ-006.
