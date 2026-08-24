## [FE-IMP-019] impProjetoGuard — guard de UUID e empresa (libs/imp/access)

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/imp/access/src/lib/guards/imp-projeto.guard.ts` implementa `impProjetoGuard` que valida o
`:projetoId` route param como UUID bem-formado; redireciona para a biblioteca de projetos caso
malformado.

**Context / Problem statement:**
- SPEC-01 §3 define `impProjetoGuard` para a rota `/imp/projetos/:projetoId/importar`:
  valida que o param é UUID bem-formado; a existência real é responsabilidade do servidor (422).
- Sem este guard, um `projetoId` mal-formado chegaria ao upload, o request seria rejeitado
  pelo servidor com 422, mas o UX seria pior.
- Bloqueia: FE-IMP-002 (rota usa impProjetoGuard)

**Approach (execution path):**
1. Criar `impProjetoGuard` como `CanActivateFn` em `libs/imp/access`:
   - Ler `:projetoId` de `ActivatedRouteSnapshot.paramMap`.
   - Validar regex UUID v4: `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`.
   - Se inválido: retornar `router.createUrlTree(['/projetos'])` (biblioteca de projetos).
   - Se válido: retornar `true`.
2. Adicionar ao `libs/imp/access/src/index.ts`.

**Non-goals:**
- Não valida existência do projeto no servidor (responsabilidade da API — 422 projeto-not-found).
- Não implementa `authGuard`, `empresaGuard`, `accessGuard` (são do shared).

**Layer(s):**
frontend / libs/imp/access

**Bounded context:**
imp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/SPEC-01-route-map.md` (§3)

**Architecture alignment:**
- Tag Nx: `scope:imp`, `type:domain`

**Implementation checklist (by file):**

**Lib: libs/imp/access**
- 🔲 `libs/imp/access/src/lib/guards/imp-projeto.guard.ts`
- 🔲 `libs/imp/access/src/index.ts` (re-export)

**Tests**
- 🔲 `nx test imp-access` PASS (UUID válido → true; string inválida → redirect para /projetos;
  UUID v3/v5 → redirect)
- 🔲 `nx lint imp-access` PASS

**Milestone:**
Wave 4 / P5 Access Guards

**Labels:**
type:feature
layer:frontend
scope:imp
priority:P5

**Acceptance criteria:**
- `npx nx test imp-access` PASS
- `npx nx lint imp-access` PASS
- `npx nx build imp-access` PASS
- UUID bem-formado retorna `true`
- UUID malformado retorna UrlTree para `/projetos`

**Dependencies:**
- FE-IMP-002 (rota que usa o guard)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum

**Testing / Evidence required:**
- Testes parametrizados com UUIDs válidos e inválidos

**Risks / Notes:**
- Confirmar rota da biblioteca de projetos: pode ser `/projetos` ou `/proj/biblioteca` dependendo
  da implementação do módulo PROJ.
