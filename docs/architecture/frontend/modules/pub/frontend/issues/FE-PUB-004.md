## [FE-PUB-004] Shell registration — PUB_MODULE_DESCRIPTOR em module-descriptors.ts

**Status:** ✅ DONE
**GitHub:** [#TBD]

**Outcome:**
`apps/cordele-web/src/app/shell/module-descriptors.ts` inclui `PUB_MODULE_DESCRIPTOR` no array
`MODULE_DESCRIPTORS`. O Shell descobre PUB (rotas, menu, permissões) exclusivamente por este descriptor,
sem hard-code inline.

**Context / Problem statement:**
- SPEC-06 §1 define o ponto de extensão: Shell importa PUB_MODULE_DESCRIPTOR de `@cordele/pub`.
- Sem este registro, o Shell não carrega PUB lazy nem exibe o item de menu "Exportar".
- Bloqueia: FE-PUB-027 (e2e T07 — Shell não navega sem descriptor)

**Approach (execution path):**
1. Abrir `apps/cordele-web/src/app/shell/module-descriptors.ts`.
2. Importar `PUB_MODULE_DESCRIPTOR` de `@cordele/pub` (libs/pub/shell-entry).
3. Adicionar `PUB_MODULE_DESCRIPTOR` no array `MODULE_DESCRIPTORS` (após PROJ).
4. Verificar que nenhuma rota de PUB está hard-coded no app-routing ou no shell.

**Non-goals:**
- Não modifica PUB_MODULE_DESCRIPTOR em si (FE-PUB-003).
- Não configura o AppRouter global (já existente).

**Layer(s):**
frontend / apps/cordele-web (Shell entry)

**Bounded context:**
pub ↔ shell

**Service execution spec(s):**
- `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-06-shell-integration.md` (§1)

**Architecture alignment:**
- Tag Nx: `scope:shell`, `type:app`
- Shell nunca hard-coda rotas de PUB inline

**Implementation checklist (by file):**

**App: apps/cordele-web**
- 🔲 `apps/cordele-web/src/app/shell/module-descriptors.ts` (adicionar PUB_MODULE_DESCRIPTOR)

**Tests**
- 🔲 `nx lint cordele-web` PASS (import boundary ok)
- 🔲 `nx build cordele-web` PASS

**Milestone:**
Wave 1 / P1 Foundation

**Labels:**
type:feature
layer:frontend
scope:pub
priority:P1

**Acceptance criteria:**
- `npx nx build cordele-web` PASS
- `MODULE_DESCRIPTORS` contém entrada com `key === 'pub'`
- Nenhuma rota PUB hard-coded fora de PUB_MODULE_DESCRIPTOR

**Dependencies:**
- FE-PUB-003 (PUB_MODULE_DESCRIPTOR)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum

**Testing / Evidence required:**
- Build do shell sem erros de import

**Risks / Notes:**
- Confirmar que `@cordele/pub` está no tsconfig paths antes da issue.
