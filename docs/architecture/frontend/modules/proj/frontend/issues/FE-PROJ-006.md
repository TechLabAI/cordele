## [FE-PROJ-006] Shell registration — module-descriptors.ts, home redirect

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`apps/cordele-web/src/app/module-descriptors.ts` inclui `PROJ_MODULE_DESCRIPTOR` com `order: 0` e
`isHome: true`. O shell redireciona `''` → `/biblioteca-de-projetos` como landing padrão pós-login.

**Context / Problem statement:**
- SPEC-06 §1 define que o shell usa o descriptor estático como fallback se o registry em runtime
  não estiver disponível.
- PROJ é o módulo home: `isHome: true` + `order: 0` — deve aparecer primeiro no nav e receber o
  redirect de login.
- A entrada no `MODULE_DESCRIPTORS[]` é a cola entre o shell e o módulo PROJ.
- Bloqueia: (nenhuma issue subsequente diretamente, mas sem isto o app não funciona de ponta a ponta)

**Approach (execution path):**
1. Abrir `apps/cordele-web/src/app/module-descriptors.ts`.
2. Adicionar `PROJ_MODULE_DESCRIPTOR` importado de `@cordele/proj` como primeira entrada (antes de IMP).
3. Verificar que o shell usa `isHome` para montar o redirect `'' → isHome.menu.route`.
4. Se o redirect ainda não existir, adicionar em `app.routes.ts`:
   `{ path: '', redirectTo: moduleDescriptors.find(d => d.menu.isHome)?.menu.route ?? '/biblioteca-de-projetos', pathMatch: 'full' }`.
5. Adicionar `projInit` e `projDestroy` ao ciclo de vida do shell (se o shell suportar `onInit`/`onDestroy` por módulo).

**Non-goals:**
- Não implementa o descriptor (FE-PROJ-004).
- Não implementa o redirect de login (responsabilidade do authGuard/shell auth flow).

**Layer(s):**
frontend / apps/cordele-web (shell)

**Bounded context:**
proj (cross-cutting: shell)

**Service execution spec(s):**
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-06-shell-integration.md` (§1)

**Architecture alignment:**
- Tag Nx: `scope:shell`, `type:app`
- Shell importa PROJ apenas via `@cordele/proj` (importPath) e o descriptor

**Implementation checklist (by file):**

**App: apps/cordele-web**
- 🔲 `apps/cordele-web/src/app/module-descriptors.ts` — adiciona `PROJ_MODULE_DESCRIPTOR`
- 🔲 `apps/cordele-web/src/app/app.routes.ts` — redirect `''` → `/biblioteca-de-projetos` (via isHome)

**Tests**
- 🔲 `nx test cordele-web` PASS — `MODULE_DESCRIPTORS` contém `key === 'proj'` com `isHome === true`
- 🔲 `nx lint cordele-web` PASS

**Milestone:**
Wave 1 / P1 Foundation

**Labels:**
type:feature
layer:frontend
scope:proj
priority:P1

**Acceptance criteria:**
- `npx nx test cordele-web` PASS
- `npx nx lint cordele-web` PASS
- `npx nx build cordele-web` PASS (sem erros)
- Navegação para `''` após login redireciona para `/biblioteca-de-projetos`
- Entrada "Projetos" aparece no nav com ícone `library_books`

**Dependencies:**
- FE-PROJ-004 (PROJ_MODULE_DESCRIPTOR deve existir)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum

**Testing / Evidence required:**
- Teste de integração: `RouterTestingHarness.navigate('/')` → URL final = `/biblioteca-de-projetos`

**Risks / Notes:**
- Se outros módulos já se declaram como home, definir a prioridade pelo `order`; PROJ tem `order: 0`.
- Verificar que IMP, COMP e PUB descriptors NÃO têm `isHome: true`.
