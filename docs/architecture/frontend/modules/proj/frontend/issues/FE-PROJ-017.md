## [FE-PROJ-017] projProjetoGuard — UUID validation + resolvability no empresa context

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/proj/access` expõe `projProjetoGuard` que valida o `:projetoId` como UUID bem formado
e resolvível na empresa ativa antes de renderizar a tela T08. UUID malformado ou não encontrado
redireciona para "Projeto não encontrado" com link de volta à biblioteca.

**Context / Problem statement:**
- SPEC-01 §3 define `projProjetoGuard` como guard customizado de `libs/proj/access`.
- Protege **somente** `/projetos/:projetoId/historico` — a biblioteca não precisa deste guard.
- Pré-empta a chamada `getProjeto` com uma validação precoce; evita que um UUID malformado
  chegue ao backend e gere erros de formato (SPEC-07 §1 — sem chamar o detail endpoint).
- Resolução: `ProjetoApiService.getProjeto(id)` com 200 → ok; 404 → not-found.

**Approach (execution path):**
1. Criar `libs/proj/access/src/lib/proj-projeto.guard.ts` como `CanActivateFn`:
   - Ler `:projetoId` do `ActivatedRouteSnapshot`.
   - Validar UUID via regex (RFC 4122); se malformado → `router.parseUrl('/biblioteca-de-projetos')` + toast "Projeto não encontrado".
   - Se UUID válido → chamar `ProjetoApiService.getProjeto(id)`; 200 → `true`; 404 → redirecionar para estado `not-found`.
2. Injetar `Router` e `ProjetoApiService` via `inject()`.
3. Exportar via `libs/proj/access/src/index.ts`.

**Non-goals:**
- Não valida permissões (responsabilidade de `accessGuard('proj.view')`).
- Não renderiza a tela de "não encontrado" — só redireciona/bloqueia.

**Layer(s):**
frontend / libs/proj/access

**Bounded context:**
proj

**Service execution spec(s):**
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-01-route-map.md` (§3)

**Architecture alignment:**
- Tag Nx: `scope:proj`, `type:domain`
- `CanActivateFn` funcional (Angular 15+ standalone guards)
- Sem estado persistido além do redirect

**Implementation checklist (by file):**

**Lib: libs/proj/access**
- 🔲 `libs/proj/access/src/lib/proj-projeto.guard.ts`
- 🔲 `libs/proj/access/src/index.ts` (exporta `projProjetoGuard`)

**Tests**
- 🔲 `nx test proj-access` PASS — UUID malformado → redirect para `/biblioteca-de-projetos`
- 🔲 `nx test proj-access` PASS — UUID válido + 404 → redirect (not-found)
- 🔲 `nx test proj-access` PASS — UUID válido + 200 → `true` (guard passa)
- 🔲 `nx lint proj-access` PASS

**Milestone:**
Wave 4 / P4 Access Guards

**Labels:**
type:feature
layer:frontend
scope:proj
priority:P4

**Acceptance criteria:**
- `npx nx test proj-access` PASS
- `npx nx lint proj-access` PASS
- UUID malformado nunca dispara `GET /api/proj/projetos/{id}`

**Dependencies:**
- FE-PROJ-007 (ProjetoApiService.getProjeto)

**Data impact:**
- Nenhum

**API / Contract impact:**
- `GET /api/proj/projetos/{id}` — somente chamado se UUID for válido

**Testing / Evidence required:**
- Teste com `RouterTestingHarness` + UUID inválido → URL de destino = `/biblioteca-de-projetos`

**Risks / Notes:**
- Decidir se o guard faz a chamada HTTP ou se a valida apenas pelo UUID shape (sem HTTP).
  Recomendação: validar shape primeiro (sem HTTP); se UUID válido, o 404 é tratado pela HistoryFacade.
  Simplifica o guard e evita uma chamada duplicada (guard + facade).
