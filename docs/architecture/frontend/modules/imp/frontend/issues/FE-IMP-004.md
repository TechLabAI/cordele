## [FE-IMP-004] Module descriptor — imp.descriptor.ts / IMP_MODULE_DESCRIPTOR

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/imp/shell-entry/src/lib/imp.descriptor.ts` exporta `IMP_MODULE_DESCRIPTOR` — o objeto que o
Shell usa para descobrir e montar o módulo IMP dinamicamente (chave, metadata de menu, `loadChildren`,
mapas de permissão e feature-flags).

**Context / Problem statement:**
- SPEC-06 §1 define que o Shell importa `IMP_MODULE_DESCRIPTOR` de `@cordele/imp` e o insere em
  `MODULE_DESCRIPTORS` sem hard-codar rotas.
- O descriptor carrega: `key='imp'`, `IMP_MENU_METADATA`, `loadChildren: () => import('@cordele/imp')
  .then(m => m.ImpModule)`, `IMP_PERMISSION_MAP`, `IMP_FEATURE_FLAGS`.
- Bloqueia: FE-IMP-005

**Approach (execution path):**
1. Criar `libs/imp/shell-entry/src/lib/imp.descriptor.ts` exportando `IMP_MODULE_DESCRIPTOR`.
2. `loadChildren` aponta para `ImpModule` (FE-IMP-003).
3. Importar `IMP_MENU_METADATA`, `IMP_PERMISSION_MAP`, `IMP_FEATURE_FLAGS` de `imp.contract.ts`.
4. Re-exportar `IMP_MODULE_DESCRIPTOR` via `index.ts`.

**Non-goals:**
- Não registra no shell (FE-IMP-005).

**Layer(s):**
frontend / libs/imp/shell-entry

**Bounded context:**
imp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/SPEC-06-shell-integration.md` (§1)
- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/SPEC-05-tool-contract.md` (§4)

**Architecture alignment:**
- Tag Nx: `scope:imp`, `type:app`

**Implementation checklist (by file):**

**Lib: libs/imp/shell-entry**
- 🔲 `libs/imp/shell-entry/src/lib/imp.descriptor.ts` (IMP_MODULE_DESCRIPTOR)
- 🔲 `libs/imp/shell-entry/src/index.ts` (re-export)

**Tests**
- 🔲 `nx test imp-shell-entry` PASS (descriptor tem key 'imp' e loadChildren)
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
- `IMP_MODULE_DESCRIPTOR.key === 'imp'`
- `IMP_MODULE_DESCRIPTOR.loadChildren` é uma função (lazy import)

**Dependencies:**
- FE-IMP-001 (constantes de contrato)
- FE-IMP-003 (ImpModule)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum

**Testing / Evidence required:**
- Teste de shape do descriptor

**Risks / Notes:**
- Confirmar interface `ModuleDescriptor` do Shell antes de implementar.
