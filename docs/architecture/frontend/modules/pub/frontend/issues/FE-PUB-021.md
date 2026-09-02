## [FE-PUB-021] pubProjetoGuard — UUID bem-formado, redirect em parâmetro inválido

**Status:** ✅ DONE
**GitHub:** [#TBD]

**Outcome:**
`libs/pub/access/src/lib/guards/pub-projeto.guard.ts` implementa `pubProjetoGuard`:
verifica que `:projetoId` é um UUID bem-formado; redireciona para biblioteca-de-projetos
(PROJ) caso contrário. Verificação de existência/tenant é responsabilidade do servidor (404).

**Context / Problem statement:**
- SPEC-01 §3: pubProjetoGuard — UUID well-formed; hard existence check é do servidor.
- EARS: pub-guard-uuid — redirect para PROJ library se UUID inválido.
- Bloqueia: FE-PUB-002 (routes usam este guard)

**Approach (execution path):**
1. Criar `libs/pub/access/src/lib/guards/pub-projeto.guard.ts`:
   - `CanActivateFn`
   - Ler `route.paramMap.get('projetoId')`
   - Validar UUID v4 via regex; se inválido → redirect `/biblioteca-de-projetos` (PROJ)
   - Se válido → `true`
2. Re-exportar via `libs/pub/access/src/index.ts`.

**Non-goals:**
- Não faz HTTP para verificar existência do projeto (responsabilidade do servidor).
- Não verifica status do projeto (pubStatusGuard — FE-PUB-022).

**Layer(s):**
frontend / libs/pub/access

**Bounded context:**
pub

**Service execution spec(s):**
- `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-01-route-map.md` (§3 pubProjetoGuard)

**Architecture alignment:**
- Tag Nx: `scope:pub`, `type:domain`
- Guard funcional (CanActivateFn)

**Implementation checklist (by file):**

**Lib: libs/pub/access**
- 🔲 `libs/pub/access/src/lib/guards/pub-projeto.guard.ts`
- 🔲 `libs/pub/access/src/index.ts` (re-exports)

**Tests**
- 🔲 `nx test pub-access` PASS (UUID válido → true; UUID inválido → redirect)
- 🔲 `nx lint pub-access` PASS

**Milestone:**
Wave 5 / P5 Access Guards

**Labels:**
type:feature
layer:frontend
scope:pub
priority:P5

**Acceptance criteria:**
- UUID válido: guard retorna true
- UUID inválido: guard retorna UrlTree para /biblioteca-de-projetos
- Nenhuma chamada HTTP no guard

**Dependencies:**
- FE-PUB-002 (routes)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum

**Testing / Evidence required:**
- Teste parametrizado: UUIDs válidos/inválidos

**Risks / Notes:**
- Regex UUID v4: `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`
