## [INT-FE-PUB-001] Integração @cordele/shared/access-http-base — interceptors, ErrorNormalize, traceId

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
Todas as chamadas HTTP de PUB passam pelo interceptor `@cordele/shared/access-http-base`:
`X-Correlation-Id` injetado em cada request, respostas de erro normalizadas em `AppError`
via `ErrorNormalize` (URN `type`, `title`, `status`, `detail`, `traceId`).
`traceId` alimenta todo erro renderizado em SPEC-07.

**Context / Problem statement:**
- `contracts/backend-api-cross-link.md §4/§5`: tenant resolvido server-side do JWT;
  `X-Empresa-Id` emitido como header de observabilidade; `X-Correlation-Id` ecoado na resposta.
- `ProblemDetail.traceId` mirrors `X-Correlation-Id` (SPEC-07 §1).
- PublicacaoApiService e ArtifactDownloadService (FE-PUB-007, FE-PUB-008) nunca gerenciam estes headers.
- Pré-requisito para FE-PUB-011 (error mapping) e FE-PUB-024 (estados de erro com traceId).

**Approach (execution path):**
1. Verificar que `@cordele/shared/access-http-base` está provido no escopo de PUB (root ou lazy route injector).
2. Adicionar peerDependency em `libs/pub/data-access/package.json`.
3. Testar que request de PUB tem `X-Correlation-Id` (HttpTestingController).
4. Testar que `urn:cordele:pub:manuscript-missing` (409) chega ao facade como `AppError` com URN correto.

**Non-goals:**
- Não implementa o interceptor (responsabilidade de @cordele/shared).

**Layer(s):**
frontend / libs/pub/data-access (integração com @cordele/shared)

**Bounded context:**
pub ↔ shared

**Service execution spec(s):**
- `docs/architecture/frontend/modules/pub/frontend/contracts/backend-api-cross-link.md` (§4, §5)
- `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-07-error-handling.md` (§1)

**Milestone:**
Wave 4 / P4 Hub Integrations

**Labels:**
type:integration
layer:frontend
scope:pub
priority:P4

**Acceptance criteria:**
- Requests de PUB têm `X-Correlation-Id`
- `ProblemDetail` de PUB chega ao facade como `AppError { type, title, detail, traceId }`
- ErrorNormalize é agnóstico ao namespace `urn:cordele:pub:`

**Dependencies:**
- FE-PUB-007, FE-PUB-008

**Risks / Notes:**
- Confirmar que ErrorNormalize de @cordele/shared/access-http-base suporta namespace `urn:cordele:pub:` sem ajuste.
