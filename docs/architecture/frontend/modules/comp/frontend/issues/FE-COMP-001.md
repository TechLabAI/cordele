## [FE-COMP-001] Module contract — comp.contract.ts, permission-map, feature-flags

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/comp/shell-entry/src/lib/` contém os artefatos de contrato do módulo COMP:
`comp.contract.ts` com `MODULE_KEY`, `COMP_MENU_METADATA`, `COMP_PERMISSION_MAP` e
`COMP_FEATURE_FLAGS`. COMP é um módulo mid-pipeline (`hiddenFromNav: true`, `order: 2`),
acessado com `projetoId` a partir do PROJ ou IMP, nunca como landing.

**Context / Problem statement:**
- Ponto de entrada obrigatório para toda a cadeia FE de COMP; sem as constantes, routes,
  guards, descriptor e shell registration não têm o que importar.
- SPEC-05 §1 define `MODULE_KEY = 'comp'`, `COMP_MENU_METADATA` (hiddenFromNav, route com
  `:projetoId`), `COMP_PERMISSION_MAP` (comp.view / comp.edit) e `COMP_FEATURE_FLAGS`
  (comp.coverUpload / comp.imageAlignment).
- Permissões mapeiam os BE scopes `comp:read` e `comp:write` (api-contract §2).
- Bloqueia: FE-COMP-002, FE-COMP-003, FE-COMP-019, FE-COMP-020

**Approach (execution path):**
1. Criar `libs/comp/shell-entry/src/lib/comp.contract.ts` com:
   - `MODULE_KEY = 'comp'`
   - `COMP_MENU_METADATA`: label `Composição`, icon `tune`, order 2, isHome false, hiddenFromNav true, route `/projetos/:projetoId/config`
   - `COMP_PERMISSION_MAP`: `comp.view → { beScope: 'comp:read' }`, `comp.edit → { beScope: 'comp:write' }`
   - `COMP_FEATURE_FLAGS`: `comp.coverUpload → { defaultState: 'on' }`, `comp.imageAlignment → { defaultState: 'on' }`
2. Re-exportar via `index.ts` da lib.
3. Reutilizar tipos `ModuleMenuMetadata`, `ModulePermissionMap`, `ModuleFeatureFlags` de `@cordele/shared` se existirem.

**Non-goals:**
- Não implementa descriptor nem bootstrap (FE-COMP-003).
- Não registra no shell (FE-COMP-005).
- Não cria routes (FE-COMP-002).

**Layer(s):**
frontend / libs/comp/shell-entry

**Bounded context:**
comp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-05-tool-contract.md` (§1, §2, §3)

**Architecture alignment:**
- Tag Nx: `scope:comp`, `type:app` (shell-entry)
- Nenhum componente testa roles diretamente — só `AccessDecisionService`
- COMP nunca escreve status nem chama advanceTo (api-contract §0 D-M)

**Implementation checklist (by file):**

**Lib: libs/comp/shell-entry**
- 🔲 `libs/comp/shell-entry/src/lib/comp.contract.ts`
- 🔲 `libs/comp/shell-entry/src/index.ts` (re-exports)

**Tests**
- 🔲 `nx test comp-shell-entry` PASS (constantes exportadas têm os valores esperados)
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
- `COMP_PERMISSION_MAP` contém exatamente `comp.view` e `comp.edit`
- `COMP_FEATURE_FLAGS` contém exatamente `comp.coverUpload` e `comp.imageAlignment`
- `COMP_MENU_METADATA.hiddenFromNav === true` e `order === 2`

**Dependencies:**
- (nenhuma — issue inaugural)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum (só constantes de configuração)

**Testing / Evidence required:**
- Teste unitário valida shape dos objetos exportados

**Risks / Notes:**
- Verificar se `ModuleMenuMetadata` / `ModulePermissionMap` / `ModuleFeatureFlags` já existem em `@cordele/shared`; evitar redefinição duplicada.
- `hiddenFromNav: true` é crítico: COMP não aparece na nav global — é acessado apenas via handoff com projetoId.
