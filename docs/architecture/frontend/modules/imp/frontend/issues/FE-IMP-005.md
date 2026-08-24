## [FE-IMP-005] Shell registration — module-descriptors.ts entry

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`apps/cordele-web/src/app/shell/module-descriptors.ts` inclui `IMP_MODULE_DESCRIPTOR` no array
`MODULE_DESCRIPTORS`, tornando o módulo IMP visível para o Shell sem hard-codar rotas.

**Context / Problem statement:**
- SPEC-06 §1 define que o Shell mantém `MODULE_DESCRIPTORS: ModuleDescriptor[]` como array estático
  (fallback quando a descoberta dinâmica não está disponível).
- IMP deve ser o primeiro entry da lista (passo 1 do pipeline editorial, order 10).
- Bloqueia: INT-FE-IMP-004 (AccessDecisionService precisa do mapa de permissões do descriptor)

**Approach (execution path):**
1. Editar `apps/cordele-web/src/app/shell/module-descriptors.ts` (ou criar se não existir).
2. Importar `IMP_MODULE_DESCRIPTOR` de `@cordele/imp`.
3. Inserir no array `MODULE_DESCRIPTORS` na posição que corresponde a `order: 10`.
4. Build e lint sem erros.

**Non-goals:**
- Não altera lógica de routing do shell (o Shell já usa `loadChildren` do descriptor).
- Não registra COMP/PUB/PROJ (responsabilidade dos módulos respectivos).

**Layer(s):**
frontend / apps/cordele-web (shell config)

**Bounded context:**
imp (shell integration)

**Service execution spec(s):**
- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/SPEC-06-shell-integration.md` (§1)

**Architecture alignment:**
- Tag Nx: `scope:shared`, `type:app` (app shell)

**Implementation checklist (by file):**

**App: apps/cordele-web**
- 🔲 `apps/cordele-web/src/app/shell/module-descriptors.ts` (entry IMP_MODULE_DESCRIPTOR)

**Tests**
- 🔲 `nx test cordele-web` PASS (MODULE_DESCRIPTORS contém entry com key 'imp')
- 🔲 `nx lint cordele-web` PASS

**Milestone:**
Wave 1 / P1 Foundation

**Labels:**
type:feature
layer:frontend
scope:imp
priority:P1

**Acceptance criteria:**
- `npx nx test cordele-web` PASS
- `npx nx lint cordele-web` PASS
- `npx nx build cordele-web` PASS
- `MODULE_DESCRIPTORS` tem entry com `key === 'imp'`
- O Shell não hard-coda `/imp` em nenhum outro arquivo além do descriptor

**Dependencies:**
- FE-IMP-004 (IMP_MODULE_DESCRIPTOR)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum

**Testing / Evidence required:**
- Screenshot do menu lateral mostrando "Importação" após integração

**Risks / Notes:**
- Se `module-descriptors.ts` ainda não existir no scaffold do shell, criar com array `[IMP_MODULE_DESCRIPTOR]`.
