## [FE-IMP-001] Module contract — imp.contract.ts, permission-map, feature-flags

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/imp/shell-entry/src/lib/` contém os quatro artefatos de contrato do módulo IMP:
`imp.contract.ts`, `imp.permission-map.ts`, `imp.feature-flags.ts` e `imp.menu-metadata.ts`.
O Shell e os guards referenciam exclusivamente essas constantes.

**Context / Problem statement:**
- Ponto de partida obrigatório para toda a cadeia FE; sem o contrato, routes, guards, descriptor e
  shell registration não têm constantes para importar.
- SPEC-05 §1 define `MODULE_KEY`, `IMP_MENU_METADATA`, `IMP_PERMISSION_MAP`, `IMP_FEATURE_FLAGS`.
- Bloqueia: FE-IMP-002, FE-IMP-004, FE-IMP-005

**Approach (execution path):**
1. Criar `libs/imp/shell-entry/src/lib/imp.contract.ts` com `MODULE_KEY = 'imp'` e `IMP_MENU_METADATA`
   (label, icon `upload_file`, order 10, section `projeto`, route `/imp/upload`).
2. Criar `imp.permission-map.ts` com `IMP_PERMISSION_MAP` (imp.import, imp.review, imp.confirm).
3. Criar `imp.feature-flags.ts` com `IMP_FEATURE_FLAGS` (imp.reimport:on, imp.ignoreFragment:on,
   imp.existingProject:on).
4. Re-exportar tudo via `index.ts` da lib.
5. Adicionar tipos locais `ModuleMenuMetadata`, `ModulePermissionMap`, `ModuleFeatureFlags` se não
   existirem em `@cordele/shared`; caso existam, importar de lá.

**Non-goals:**
- Não implementa descriptor nem bootstrap (FE-IMP-004).
- Não registra no shell (FE-IMP-005).

**Layer(s):**
frontend / libs/imp/shell-entry

**Bounded context:**
imp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/SPEC-05-tool-contract.md` (§1, §2, §3)

**Architecture alignment:**
- Standalone + OnPush + Signals (não se aplica a constantes puras)
- Tag Nx: `scope:imp`, `type:app` (shell-entry)
- Nenhum componente testa roles diretamente — só `AccessDecisionService`

**Implementation checklist (by file):**

**Lib: libs/imp/shell-entry**
- 🔲 `libs/imp/shell-entry/src/lib/imp.contract.ts`
- 🔲 `libs/imp/shell-entry/src/lib/imp.permission-map.ts`
- 🔲 `libs/imp/shell-entry/src/lib/imp.feature-flags.ts`
- 🔲 `libs/imp/shell-entry/src/index.ts` (re-exports)

**Tests**
- 🔲 `nx test imp-shell-entry` PASS (Jest unit — constantes exportadas têm os valores esperados)
- 🔲 `nx lint imp-shell-entry` PASS (boundaries + ESLint)

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
- `npx nx build imp-shell-entry` PASS (sem erros)
- `IMP_PERMISSION_MAP` contém exatamente `imp.import`, `imp.review`, `imp.confirm`
- `IMP_FEATURE_FLAGS` contém exatamente `imp.reimport`, `imp.ignoreFragment`, `imp.existingProject`

**Dependencies:**
- (nenhuma — issue inaugural)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum (só constantes de configuração)

**Testing / Evidence required:**
- Teste unitário valida shape dos objetos exportados

**Risks / Notes:**
- Verificar se `ModuleMenuMetadata` / `ModulePermissionMap` / `ModuleFeatureFlags` já existem em
  `@cordele/shared`; evitar redefinição duplicada.
