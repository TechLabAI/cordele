## [INT-FE-COMP-001] Integração @cordele/shared/access-http-base — interceptors, ErrorNormalize

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
Todas as chamadas HTTP de COMP passam pelo interceptor `@cordele/shared/access-http-base`:
`X-Correlation-Id` injetado em cada request, respostas de erro normalizadas em `AppError`
via `ErrorNormalize`. O `correlationId` alimenta os estados de erro de SPEC-07.

**Context / Problem statement:**
- `contracts/backend-api-cross-link.md §1/§4`: tenant resolvido server-side do JWT;
  `X-Empresa-Id` emitido como header de observabilidade pelo interceptor (não pelo FE manual).
- `X-Correlation-Id` ecoado na resposta e no `ProblemDetail.traceId` (SPEC-07 §1).
- `MetadadosApiService` e `LayoutApiService` (FE-COMP-006, FE-COMP-007) nunca gerenciam estes
  headers; são responsabilidade do interceptor shared.
- Pré-requisito para que FE-COMP-010 (error mapping) e FE-COMP-024 (estados de erro) exibam
  `correlationId`.

**Approach (execution path):**
1. Verificar que `@cordele/shared/access-http-base` está declarado como provider no root ou no
   escopo de COMP.
2. Adicionar `peerDependencies` em `libs/comp/data-access/package.json` para `access-http-base`.
3. Testar que um request de COMP tem `X-Correlation-Id` nos headers (via `HttpTestingController`).
4. Testar que um `422 override-ref-not-found` de COMP chega ao facade como `AppError` com URN correto.

**Non-goals:**
- Não implementa o interceptor (responsabilidade de `@cordele/shared`).

**Layer(s):**
frontend / libs/comp/data-access (integração com @cordele/shared)

**Bounded context:**
comp ↔ shared

**Service execution spec(s):**
- `docs/architecture/frontend/modules/comp/frontend/contracts/backend-api-cross-link.md` (§1, §4)
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-07-error-handling.md` (§1)

**Milestone:**
Wave 2 / P4 Hub integrations

**Labels:**
type:integration
layer:frontend
scope:comp
priority:P4

**Acceptance criteria:**
- Requests de COMP têm `X-Correlation-Id`
- `ProblemDetail` de COMP chega ao facade como `AppError { code, title, detail, correlationId }`

**Dependencies:**
- FE-COMP-006, FE-COMP-007 (ApiServices)

**Risks / Notes:**
- Se o interceptor ainda não suporta COMP (namespace `urn:cordele:comp:`), confirmar que `ErrorNormalize` é agnóstico ao namespace antes de fechar esta issue.
