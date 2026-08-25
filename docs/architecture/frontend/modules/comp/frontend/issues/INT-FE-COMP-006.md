## [INT-FE-COMP-006] Integração @cordele/shared/empresa-context — empresaGuard + tenancy JWT

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`empresaGuard` de `@cordele/shared/empresa-context` está ativo nas rotas COMP e garante que
existe uma empresa activa na sessão. COMP não envia `X-Empresa-Id` no wire; a empresa é
resolvida server-side a partir do claim JWT. Troca de empresa cancela as facades de COMP.

**Context / Problem statement:**
- SPEC-01 §3: `empresaGuard` garante empresa activa; SPEC-04 §1: tenancy resolvida do JWT.
- `contracts/backend-api-cross-link.md §1`: "empresa server-resolved from the token, not a header".
- Se o utilizador trocar de empresa enquanto em COMP, as facades devem cancelar os requests
  in-flight e re-hidratar (ou navegar de volta ao PROJ).
- `POC: Editora Aetós` é a empresa seed do POC; o guard deve funcionar com ela.

**Approach (execution path):**
1. Verificar que `@cordele/shared/empresa-context` exporta `empresaGuard`.
2. Confirmar que as rotas COMP têm `empresaGuard` na cadeia (FE-COMP-002).
3. Verificar que as facades cancelam requests com `takeUntilDestroyed` (FE-COMP-008, FE-COMP-009).
4. Testar cenário de troca de empresa: as facades cancelam e não deixam estado residual.
5. Confirmar que nenhum request COMP contém `X-Empresa-Id` no body/query (header de observabilidade
   é do interceptor, não do código de COMP).

**Non-goals:**
- Não implementa `empresaGuard` (shared).
- Não implementa gestão multi-empresa (POC single-tenant).

**Layer(s):**
frontend / libs/comp/access (integração com @cordele/shared/empresa-context)

**Bounded context:**
comp ↔ shared

**Service execution spec(s):**
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-01-route-map.md` (§3 empresaGuard)
- `docs/architecture/frontend/modules/comp/frontend/contracts/backend-api-cross-link.md` (§1 tenancy)

**Milestone:**
Wave 4 / P4 Hub integrations

**Labels:**
type:integration
layer:frontend
scope:comp
priority:P4

**Acceptance criteria:**
- `empresaGuard` ativo nas rotas COMP (verificado em `comp.routes.ts`)
- Nenhum request COMP envia `X-Empresa-Id` como scoping authority
- Troca de empresa → facades cancelam requests in-flight

**Dependencies:**
- FE-COMP-002 (rotas com empresaGuard declarado)

**Risks / Notes:**
- A1 multi-tenancy (schema-per-tenant vs single-tenant) está resolvida como coluna discriminadora empresaId (precedente imp/proj) — confirmar que o `empresaGuard` do shared funciona com este modelo antes de fechar esta issue.
