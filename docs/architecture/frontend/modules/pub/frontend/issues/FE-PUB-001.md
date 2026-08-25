## [FE-PUB-001] Module contract — pub.contract.ts, permission-map, feature-flags

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/pub/shell-entry/src/lib/` contém os artefatos de contrato do módulo PUB:
`pub.contract.ts` com `MODULE_KEY = 'pub'`, `PUB_MENU_METADATA`, `PUB_PERMISSION_MAP`
(pub.view / pub.export / pub.download) e `PUB_FEATURE_FLAGS` (pub.rexport on / pub.pdfExport off).
PUB é o passo final do pipeline editorial (order: 40, isHome: false), acessado com `projetoId`
a partir de COMP (T06 "Exportar") ou PROJ.

**Context / Problem statement:**
- Ponto de entrada obrigatório para toda a cadeia FE de PUB; sem as constantes, routes,
  guards, descriptor e shell registration não têm o que importar.
- SPEC-05 §1 define MODULE_KEY, MENU_METADATA, PERMISSION_MAP e FEATURE_FLAGS.
- Permissões colapsam para BE scopes `pub:read` (pub.view + pub.download) e `pub:write` (pub.export).
- Bloqueia: FE-PUB-002, FE-PUB-003, FE-PUB-004, FE-PUB-005, FE-PUB-021, FE-PUB-022

**Approach (execution path):**
1. Criar `libs/pub/shell-entry/src/lib/pub.contract.ts`:
   - `MODULE_KEY = 'pub' as const`
   - `PUB_MENU_METADATA`: label 'Publicação', icon 'publish', order 40, section 'projeto', route '/pub', isHome false
   - `PUB_PERMISSION_MAP`: pub.view, pub.export, pub.download com descrições do SPEC-05 §1
   - `PUB_FEATURE_FLAGS`: pub.rexport (defaultState 'on'), pub.pdfExport (defaultState 'off')
2. Reutilizar tipos `ModuleMenuMetadata`, `ModulePermissionMap`, `ModuleFeatureFlags` de `@cordele/shared`.
3. Re-exportar via `index.ts` da lib.

**Non-goals:**
- Não implementa descriptor nem bootstrap (FE-PUB-003).
- Não registra no shell (FE-PUB-004).
- Não cria routes (FE-PUB-002).

**Layer(s):**
frontend / libs/pub/shell-entry

**Bounded context:**
pub

**Service execution spec(s):**
- `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-05-tool-contract.md` (§1, §2, §3)

**Architecture alignment:**
- Tag Nx: `scope:pub`, `type:app` (shell-entry)
- Nenhum componente testa roles diretamente — só `AccessDecisionService`

**Implementation checklist (by file):**

**Lib: libs/pub/shell-entry**
- 🔲 `libs/pub/shell-entry/src/lib/pub.contract.ts`
- 🔲 `libs/pub/shell-entry/src/lib/pub.permission-map.ts`
- 🔲 `libs/pub/shell-entry/src/lib/pub.feature-flags.ts`
- 🔲 `libs/pub/shell-entry/src/index.ts` (re-exports)

**Tests**
- 🔲 `nx test pub-shell-entry` PASS (constantes exportadas têm os valores esperados)
- 🔲 `nx lint pub-shell-entry` PASS

**Milestone:**
Wave 1 / P1 Foundation

**Labels:**
type:feature
layer:frontend
scope:pub
priority:P1

**Acceptance criteria:**
- `npx nx test pub-shell-entry` PASS
- `npx nx lint pub-shell-entry` PASS
- `npx nx build pub-shell-entry` PASS
- `PUB_PERMISSION_MAP` contém exatamente `pub.view`, `pub.export` e `pub.download`
- `PUB_FEATURE_FLAGS.pub.pdfExport.defaultState === 'off'`

**Dependencies:**
- (nenhuma — issue inaugural)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum (só constantes de configuração)

**Testing / Evidence required:**
- Teste unitário valida shape dos objetos exportados

**Risks / Notes:**
- Verificar se `ModuleMenuMetadata` / `ModulePermissionMap` / `ModuleFeatureFlags` já existem em `@cordele/shared`.
- `pub.pdfExport` deve permanecer `off` até que o BE implemente exportação PDF (fora do MVP).
