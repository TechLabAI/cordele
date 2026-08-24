## [INT-FE-IMP-001] Integração @cordele/shared/access-http-base — interceptors, ErrorNormalize

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`ManuscriptApiService` e todas as chamadas HTTP de IMP são interceptadas por
`@cordele/shared/access-http-base`: `X-Correlation-Id` + `X-Empresa-Id` injetados, respostas
de erro normalizadas em `AppError` via `ErrorNormalize` interceptor.

**Context / Problem statement:**
- `backend-api-cross-link.md §5` especifica que tenant é resolvido server-side do JWT mas
  `X-Empresa-Id` é também enviado pelo FE via interceptor para correlação/observabilidade.
- `X-Correlation-Id` é injetado em cada request e ecoado na resposta + `ProblemDetail.traceId`.
- `ManuscriptApiService` NÃO deve gerenciar esses headers — é responsabilidade do interceptor.
- Qualquer resposta BE `4xx`/`5xx` chega como `AppError` normalizado.

**Context / Approach:**
1. Verificar que `@cordele/shared/access-http-base` está declarado como provider no app root
   (`cordele-web`) ou no module scope de IMP.
2. Adicionar ao `libs/imp/data-access` como peer dependency (peerDependencies em `package.json`).
3. Testar que um request de IMP tem `X-Correlation-Id` e `X-Empresa-Id` nos headers (via
   `HttpTestingController.expectOne` + `request.headers.has('X-Correlation-Id')`).
4. Testar que um 422 de IMP chega ao facade como `AppError` com `type` URN correto.

**Non-goals:**
- Não implementa o interceptor (pertence a `@cordele/shared`).

**Layer(s):**
frontend / libs/imp/data-access (consumidor do shared)

**Bounded context:**
imp (cross-cutting integration)

**Service execution spec(s):**
- `docs/architecture/frontend/modules/imp/frontend/contracts/backend-api-cross-link.md` (§5)
- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/SPEC-07-error-handling.md` (§2)

**Architecture alignment:**
- Tag Nx: `scope:imp`, `type:data-access`

**Implementation checklist (by file):**

**Lib: libs/imp/data-access**
- 🔲 Verificar provider de `access-http-base` no escopo de IMP
- 🔲 `peerDependencies` em `libs/imp/data-access/package.json`

**Tests**
- 🔲 `nx test imp-data-access` PASS (headers presentes; 422 → AppError)
- 🔲 `nx lint imp-data-access` PASS

**Milestone:**
Wave 2 / P4 Integrações

**Labels:**
type:integration
layer:frontend
scope:imp
priority:P4

**Acceptance criteria:**
- `X-Correlation-Id` presente em todos requests IMP
- `X-Empresa-Id` presente em todos requests IMP
- 422 chega ao facade como `AppError` (não como resposta crua)

**Dependencies:**
- FE-IMP-007 (ManuscriptApiService)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Todos endpoints IMP (via shared interceptor)

**Testing / Evidence required:**
- Teste de integração com `HttpTestingController` verificando headers

**Risks / Notes:**
- Se `access-http-base` ainda não tiver `ErrorNormalize` implementado, bloquear FE-IMP-021
  até que o shared providencie.
