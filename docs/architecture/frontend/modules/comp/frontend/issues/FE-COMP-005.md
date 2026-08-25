## [FE-COMP-005] Shell registration — module-descriptors.ts fallback entry

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`apps/cordele-web/src/app/module-descriptors.ts` (ou equivalente) inclui `COMP_MODULE_DESCRIPTOR`
no array `MODULE_DESCRIPTORS`. COMP é carregado como `hiddenFromNav` (não aparece na nav
global), mas o shell pode fazer lazy-load via `@cordele/comp` e posicionar o step-bar.

**Context / Problem statement:**
- SPEC-06 §1 especifica que o shell inclui o descriptor de COMP para lazy-load e step-bar.
- COMP não tem entrada na nav global (hiddenFromNav), mas o shell precisa do descriptor para
  resolver `@cordele/comp` e construir o step bar pipeline (Importar › Configurar › ...).
- Sem esta entrada, um handoff PROJ → COMP falha com route-not-found.
- Bloqueia: FE-COMP-011, FE-COMP-014 (telas dependem do shell carregar o módulo)

**Approach (execution path):**
1. Localizar `apps/cordele-web/src/app/module-descriptors.ts` (ou onde MODULE_DESCRIPTORS é definido).
2. Importar `COMP_MODULE_DESCRIPTOR` de `@cordele/comp`.
3. Inserir na posição order:2 (após IMP, antes de PUB): `COMP_MODULE_DESCRIPTOR`.
4. Verificar que o shell não adiciona COMP à nav lateral (hiddenFromNav).

**Non-goals:**
- Não implementa o descriptor (FE-COMP-003).
- Não modifica a lógica de nav do shell além da entrada no array.

**Layer(s):**
frontend / apps/cordele-web

**Bounded context:**
comp (ponto de entrada no shell)

**Service execution spec(s):**
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-06-shell-integration.md` (§1)

**Architecture alignment:**
- Tag Nx: escopo do shell (app)
- Import de `@cordele/comp` (importPath de shell-entry)

**Implementation checklist (by file):**

**App: apps/cordele-web**
- 🔲 `apps/cordele-web/src/app/module-descriptors.ts` (COMP_MODULE_DESCRIPTOR adicionado)

**Tests**
- 🔲 `nx build cordele-web` PASS (lazy chunk de comp resolvido)
- 🔲 `nx lint cordele-web` PASS

**Milestone:**
Wave 1 / P1 Foundation

**Labels:**
type:feature
layer:frontend
scope:comp
priority:P1

**Acceptance criteria:**
- `npx nx build cordele-web` PASS sem warnings de chunk não resolvido
- COMP não aparece na nav global (hiddenFromNav verificado em e2e)
- Handoff de PROJ para /projetos/:projetoId/config funciona no ambiente local

**Dependencies:**
- FE-COMP-003 (descriptor pronto)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum

**Testing / Evidence required:**
- Build passando com lazy chunk de `comp`

**Risks / Notes:**
- Verificar se o shell de outros módulos (PROJ, IMP) já tem um padrão estabelecido para `MODULE_DESCRIPTORS`; seguir o mesmo para manter uniformidade.
