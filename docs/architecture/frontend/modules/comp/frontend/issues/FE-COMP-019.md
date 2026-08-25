## [FE-COMP-019] compProjetoGuard — guard de UUID e resolvabilidade do projeto

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/comp/access/src/lib/comp-projeto.guard.ts` implementa `compProjetoGuard`: valida que
`:projetoId` é UUID bem formado E resolvível na empresa ativa. Em caso de falha, redireciona
para "Projeto não encontrado" **sem** chamar nenhum endpoint de comp-service. Pré-empta o
`404 urn:cordele:comp:projeto-not-found` do BE.

**Context / Problem statement:**
- SPEC-01 §3: `compProjetoGuard` verifica UUID bem formado + resolvibilidade na empresa ativa.
  Não existia no shell antes desta issue — é NOVO (warning M3/M4).
- SPEC-07 §1: `urn:cordele:comp:projeto-not-found (404)` → pré-emptado pelo guard.
- O guard **não faz HTTP** para comp-service; pode fazer uma lightweight verificação contra
  o cache local de projetos do PROJ (se existir) ou validar só o UUID.
- Ambas as rotas COMP dependem deste guard (FE-COMP-002).

**Approach (execution path):**
1. Criar `libs/comp/access/src/lib/comp-projeto.guard.ts` como função CanActivateFn.
2. Extrair `projetoId` de `ActivatedRouteSnapshot.params`.
3. Validar formato UUID (regex); se inválido → `router.createUrlTree(['/projetos', 'nao-encontrado'])`.
4. Se possível, verificar resolvibilidade na empresa ativa via ProjetoStore/cache do PROJ;
   se indisponível, deixar o BE retornar o 404 (degradação graceful).
5. Exportar via `index.ts` da lib.

**Non-goals:**
- Não verifica status do projeto (responsabilidade de `compStatusGuard`, FE-COMP-020).
- Não faz chamadas a `comp-service`.

**Layer(s):**
frontend / libs/comp/access

**Bounded context:**
comp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-01-route-map.md` (§3)
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-07-error-handling.md` (§1 projeto-not-found)

**Architecture alignment:**
- Tag Nx: `scope:comp`, `type:domain`
- CanActivateFn (functional guard, Angular 15+)
- Boundaries: pode importar `scope:proj` apenas para ProjetoStore se necessário; nunca importa libs de feature

**Implementation checklist (by file):**

**Lib: libs/comp/access**
- 🔲 `libs/comp/access/src/lib/comp-projeto.guard.ts`
- 🔲 `libs/comp/access/src/index.ts` (re-export)
- 🔲 `libs/comp/access/project.json` (tags scope:comp, type:domain)

**Tests**
- 🔲 `nx test comp-access` PASS
  - UUID malformado → redireciona sem HTTP
  - UUID válido → passa (ou redireciona se empresa não reconhece)
- 🔲 `nx lint comp-access` PASS

**Milestone:**
Wave 4 / P5 Access guards

**Labels:**
type:feature
layer:frontend
scope:comp
priority:P5

**Acceptance criteria:**
- `npx nx test comp-access` PASS
- `npx nx lint comp-access` PASS
- UUID malformado redireciona sem chamar comp-service
- Guard registrado nas rotas de FE-COMP-002

**Dependencies:**
- FE-COMP-002 (rotas que usam o guard)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum (guard não emite HTTP para comp-service)

**Testing / Evidence required:**
- Teste: UUID inválido → UrlTree para nao-encontrado; UUID válido → true

**Risks / Notes:**
- Se o PROJ não expõe um ProjetoStore acessível da lib `comp/access`, simplificar para validação de UUID apenas e deixar o BE tratar o 404 real (degradação aceitável no MVP).
