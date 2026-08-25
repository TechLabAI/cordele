## [INT-FE-PROJ-001] Integração @cordele/shared/access-http-base — interceptors, ErrorNormalize

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`ProjetoApiService` e todas as chamadas HTTP de PROJ são interceptadas por
`@cordele/shared/access-http-base`: `X-Correlation-Id` injetado em cada request, respostas de
erro normalizadas em `AppError` via `ErrorNormalize` interceptor. O `correlationId` da resposta
alimenta as mensagens de erro de SPEC-07.

**Context / Problem statement:**
- `contracts/backend-api-cross-link.md §5` especifica que tenant é resolvido server-side do JWT
  (api-contract §2); `X-Empresa-Id` pode ser emitido como header de observabilidade pelo interceptor.
- `X-Correlation-Id` é injetado em cada request e ecoado na resposta + `ProblemDetail.traceId`.
- `ProjetoApiService` NÃO gerencia esses headers — é responsabilidade do interceptor shared.
- `ErrorNormalize` converte qualquer `ProblemDetail` (RFC 7807) em `AppError { code, title, detail, correlationId }`.
- Esta integração é precondição para que FE-PROJ-020 (error states) exiba o `correlationId`.

**Approach (execution path):**
1. Verificar que `@cordele/shared/access-http-base` está declarado como provider no app root ou
   no escopo de PROJ.
2. Adicionar `peerDependencies` em `libs/proj/data-access/package.json` para `access-http-base`.
3. Testar que um request de PROJ tem `X-Correlation-Id` nos headers (via `HttpTestingController`).
4. Testar que um 409 de PROJ chega ao facade como `AppError` com URN correto (`urn:cordele:proj:...`).

**Non-goals:**
- Não implementa o interceptor (responsabilidade de `@cordele/shared`).

**Layer(s):**
frontend / libs/proj/data-access (consumidor do shared)

**Bounded context:**
proj (cross-cutting integration)

**Service execution spec(s):**
- `docs/architecture/frontend/modules/proj/frontend/contracts/backend-api-cross-link.md` (§5)
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-07-error-handling.md` (§1)

**Architecture alignment:**
- Tag Nx: `scope:proj`, `type:data-access`

**Implementation checklist (by file):**

**Lib: libs/proj/data-access**
- 🔲 Verificar provider de `access-http-base` no escopo de PROJ
- 🔲 `peerDependencies` em `libs/proj/data-access/package.json`

**Tests**
- 🔲 `nx test proj-data-access` PASS — `X-Correlation-Id` presente nos requests PROJ
- 🔲 `nx test proj-data-access` PASS — 409 → `AppError` com URN correto (não resposta crua)
- 🔲 `nx lint proj-data-access` PASS

**Milestone:**
Wave 2 / P4 Integrações

**Labels:**
type:integration
layer:frontend
scope:proj
priority:P4

**Acceptance criteria:**
- `X-Correlation-Id` presente em todos os requests PROJ
- 409 com `ProblemDetail` chega ao facade como `AppError` normalizado
- `correlationId` propagado até as mensagens de erro de SPEC-07

**Dependencies:**
- FE-PROJ-007 (ProjetoApiService)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Todos os endpoints PROJ (via shared interceptor)

**Testing / Evidence required:**
- Teste com `HttpTestingController.expectOne` verificando header

**Risks / Notes:**
- Se `access-http-base` ainda não tiver `ErrorNormalize` implementado, bloquear FE-PROJ-020
  até que o shared providencie.
