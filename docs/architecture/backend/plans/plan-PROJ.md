# Plano -- PROJ (proj-service, Projetos Editoriais)

## Status das prioridades

- P1 -- pendente
- P2 -- pendente
- P3 -- pendente
- P4 -- pendente
- P5 -- pendente
- P6 -- pendente
- P7 -- pendente
- P8 -- pendente

---

## 0. Leitura executiva

### Papel do serviço

`proj-service` is the **Projects** module of the Cordelê modular monolith: it owns the
`ProjetoEditorial` aggregate — the identity every other context (IMP, COMP, PUB) binds to —
and is the **sole authority** over project lifecycle status (ADR-002). It is the cascade root
for LGPD erasure and the source of the cross-context read composition that powers the editorial
library (T02) and the download/history screen (T08).

Key architectural constraints:
- Status transitions (`rascunho → em_composicao → publicado|com_erros`) are driven by the
  `ProjectStatus` value object; IMP and PUB trigger transitions via the `AdvanceProjetoStatusUseCase`
  inbound port; the one deliberate backward edge (`reopen`) is a separate use case (ADR-002 / D-D).
- Publication history (T08) is a **read-model over PUB** via `PublicationHistoryPort` — PROJ stores
  no publication rows (ADR-003 / D-E).
- Download URLs are signed by PUB; PROJ never proxies bytes (D-F).
- LGPD deletion is an orchestrated, **leaf-first, idempotent** in-process cascade (PUB → COMP →
  IMP → projeto_editorial), aborting before the identity row on failure (D-G / SPEC-11).
- Cross-context reads (library cards, detail) are **batched by projetoId set** — never N+1 — and
  degrade gracefully with `degraded=true` when sibling ports are unavailable (SPEC-03 / SPEC-07).
- `messaging.enabled = false`; all cross-context signals are in-process events.

### MVP scope

Create project (`rascunho`) → advance lifecycle via port (`em_composicao`, `publicado`,
`com_erros`) → reopen (`em_composicao`) → list library (T02, batched cross-context read) →
project detail with history (T08) → download signed URL → LGPD delete (leaf-first cascade).

### Diagnóstico inicial (gaps mapeados em doc 06)

- **G5 (pagination/filters):** `?status`, `?limit`, `?cursor` reserved in `GET /projetos`; POC
  returns all — implementation deferred. DB-side `?status` filter is implemented in PROJ-010.
- **A1 (schema-per-tenant provisioning):** shared platform concern; `EmpresaContext` wired in
  PROJ-014; Prisma schema-targeting in PROJ-008.
- **G3 (LGPD cross-context cascade):** fully specified in SPEC-11; implemented in PROJ-016 backed
  by PROJ-015 stubs and PROJ-INT-004..006 real adapters.
- **G2 (PublicationHistoryPort field set):** fixed in api-contract §6.3 (D-E); implemented in
  PROJ-009 stub and PROJ-INT-003 real adapter.

---

## 1. Estratégia geral

### Objetivo macro

Deliver a compilable, testable NestJS `ProjModule` with full lifecycle orchestration, batched
cross-context read composition (with graceful degradation), schema-per-tenant persistence, the
complete LGPD leaf-first erasure cascade, JWT security, and BDD coverage — in 8 priorities that
the `be-implement` agent can execute one at a time.

### Ordem das prioridades

| P | Título | Motivo |
|---|---|---|
| P1 | Scaffold + API surface | Module must compile before use cases can be implemented |
| P2 | Domain + use cases (lifecycle) | Status authority VO + create/advance/reopen — all callers depend on these ports |
| P3 | Persistence + migrations | Prisma schema, repository, schema-per-tenant adapter |
| P4 | Cross-context read composition | Library and detail endpoints; degraded fallback; G5 filter reservation |
| P5 | Security | JWT guard + EmpresaContext — blocks integration testing without it |
| P6 | LGPD erasure cascade | Erasure port stubs + orchestrated DELETE — safety concern |
| P7 | Observability | Health endpoint + correlation ID + degraded logging |
| P8 | BDD end-to-end | Cucumber step definitions for 8 features (44 scenarios) |

---

## 2. Plano por prioridade

### Prioridade 1 -- Scaffold + API surface

Status: pendente

#### Objetivo / Resultado esperado

`ProjModule` compiles, all 7 REST routes registered under `/api/proj`, `pnpm build` exits 0.
All DI tokens declared for use cases and the 6 outbound ports. Stub responses serve the smoke
route before P2 use cases are implemented.

#### Issues vinculadas
- PROJ-001

#### Specs cobertas
- SPEC-01 (api-surface)

#### Sequencia de execucao
- Fase 1: Create `ProjModule` + DTOs + 7 route stubs in `ProjController`
- Fase 2: Controller spec verifying all 7 routes and DI token declarations

#### Criterios de aceite
- `pnpm build` exits 0
- All 7 routes registered and return stub responses
- DI tokens declared for all use cases and ports

#### Riscos
- DI token naming must not collide with IMP tokens

#### Instrucao para implementador

Create `src/modules/proj/` following the same pattern as `src/modules/imp/`. DI tokens go in
`src/modules/proj/proj.tokens.ts`. Routes follow api-contract §4 exactly (paths, HTTP verbs,
scopes — guards wired as stubs that allow all in P1). See IMP-001 for the exact scaffold pattern.

---

### Prioridade 2 -- Domain + use cases (lifecycle)

Status: pendente

#### Objetivo / Resultado esperado

`ProjectStatus` VO with full legal-transition table. Four use cases: create (with ProjectCreated
event), advanceTo (idempotent + audit), reopen (backward edge), and inbound port DI registry
(exported for IMP/PUB). All backed by unit tests.

#### Issues vinculadas
- PROJ-002 (ProjectStatus VO)
- PROJ-003 (CreateProjetoEditorialUseCase)
- PROJ-004 (AdvanceProjetoStatusUseCase.advanceTo)
- PROJ-005 (ReopenProjectForRevisionUseCase + REST handler)
- PROJ-006 (inbound port DI export registry)

#### Specs cobertas
- SPEC-02 (lifecycle + idempotency)
- SPEC-05 (idempotency + concurrent safety)
- integration-contracts.md §1

#### Sequencia de execucao
- Fase 1: PROJ-002 (VO first — all use cases depend on it)
- Fase 2: PROJ-003 + PROJ-004 in parallel (both depend on VO and repository)
- Fase 3: PROJ-005 (reopen — builds on advanceTo pattern)
- Fase 4: PROJ-006 (DI registry — wires all 4 providers)

#### Criterios de aceite
- All 7 legal transitions pass; all illegal transitions throw `IllegalStatusTransitionError`
- Idempotent `advanceTo` returns `changed=false` without event or history row
- `ProjectCreated` and `ProjectStatusChanged` events emitted with unique `eventId`
- 4 inbound ports exported via DI tokens (IMP can inject `CREATE_PROJETO_USE_CASE`)

#### Riscos
- Use cases depend on `ProjetoEditorialRepository` (P3) — unit tests must use mocks; integration
  tests must run after P3

#### Instrucao para implementador

Implement PROJ-002 first. For PROJ-003..005, use `jest.fn()` for the repository mock in unit tests.
The repository is a constructor-injected interface — never import the Prisma adapter directly in use
cases. See IMP-002 for the event-emitter pattern (post-commit hook via NestJS `EventEmitter2`).

---

### Prioridade 3 -- Persistence + migrations

Status: pendente

#### Objetivo / Resultado esperado

`schema.prisma` with `ProjetoEditorial` and `ProjetoStatusHistorico` models. Initial migrations.
`ProjetoEditorialRepository` Prisma adapter with schema-per-tenant resolution from `EmpresaContext`.

#### Issues vinculadas
- PROJ-007 (Prisma schema + migrations)
- PROJ-008 (ProjetoEditorialRepository adapter)

#### Specs cobertas
- SPEC-04 (data-model-migrations)

#### Sequencia de execucao
- Fase 1: PROJ-007 (schema + migrations — Prisma client must be generated before adapter)
- Fase 2: PROJ-008 (repository adapter)

#### Criterios de aceite
- `prisma migrate dev` creates both tables with CHECKs, FK cascade, and indexes
- `findById` returns `null` for cross-tenant project (isolation)
- `updateStatus` writes both tables in one `$transaction`

#### Riscos
- Schema-per-tenant requires `PrismaClient` instantiated with `schema` option from `EmpresaContext`;
  reference IMP-006 for the pattern used in the monolith

#### Instrucao para implementador

Add PROJ models to the shared `prisma/schema.prisma`. Migration files must match the reserved names
`0001_create_projeto_editorial` and `0002_create_projeto_status_historico`. The `EmpresaContext`
resolver pattern (schema switching) must match the one in `imp-service` to stay consistent.

---

### Prioridade 4 -- Cross-context read composition

Status: pendente

#### Objetivo / Resultado esperado

Outbound read port stubs (ManuscriptSummaryPort, ProjectMetadataPort, PublicationHistoryPort).
Four read use cases: library (T02, batched, degraded), detail (T08, composed), publication history
list, and signed download URL. G5 query params reserved. Real adapters (PROJ-INT-001..003) replace
stubs once IMP/COMP/PUB are scaffolded.

#### Issues vinculadas
- PROJ-009 (outbound read port stubs — batched, degraded:true)
- PROJ-010 (GetProjetoLibraryUseCase — T02, G5 reservation)
- PROJ-011 (GetProjetoDetailUseCase — T08)
- PROJ-012 (GetPublicationHistoryUseCase)
- PROJ-013 (GetSignedDownloadUrlUseCase)
- PROJ-INT-001 (ManuscriptSummaryPort real adapter → IMP)
- PROJ-INT-002 (ProjectMetadataPort real adapter → COMP)
- PROJ-INT-003 (PublicationHistoryPort real adapter → PUB)

#### Specs cobertas
- SPEC-03 (no-N+1 batching)
- SPEC-07 (degraded:true)
- api-contract §4.2..4.5, §6.2..6.4

#### Sequencia de execucao
- Fase 1: PROJ-009 (port stubs — use cases depend on them)
- Fase 2: PROJ-010, PROJ-011, PROJ-012, PROJ-013 (use cases, in parallel)
- Fase 3: PROJ-INT-001..003 (real adapters, after sibling modules are scaffolded)

#### Criterios de aceite
- Three port calls total per library request (batching invariant, verified by mock call count)
- `degraded=true` when any read port throws, library/detail endpoint still returns own fields
- `?status`, `?limit`, `?cursor` accepted by `GET /projetos` without 400 (G5 reservation)
- Download endpoint returns 409 for `erros_criticos|pendente` publications

#### Riscos
- PROJ-INT-001..003 depend on IMP/COMP/PUB being scaffolded; stubs (PROJ-009) are the fallback
  during PROJ development

#### Instrucao para implementador

Implement PROJ-009 stubs before the use cases. The batching invariant (one call per port per
request) is the hardest constraint to verify — write the port mock call count assertion in the
use case spec explicitly. The `?status` DB-side filter in PROJ-010 is a `where` clause on the
repository `findAll`; `?limit`/`?cursor` params are accepted but not applied in the POC (pass
through as `undefined`).

---

### Prioridade 5 -- Security

Status: pendente

#### Objetivo / Resultado esperado

JWT guard, `EmpresaContext` populated from JWT claim, scope guards per endpoint. All PROJ routes
return 401/403 without a valid token and scope.

#### Issues vinculadas
- PROJ-014

#### Specs cobertas
- SPEC-06 (security)

#### Sequencia de execucao
- Fase 1: PROJ-014 (guard, EmpresaContext, scope decorators applied to all 7 routes)

#### Criterios de aceite
- 401 on missing token; 403 on missing scope
- `EmpresaContext.getEditoraId()` sourced from JWT claim only

#### Riscos
- If a monolith-wide JWT guard already exists (from IMP), reuse it and apply PROJ scopes;
  do not create a duplicate guard

#### Instrucao para implementador

Check if a shared `JwtAuthGuard` and `ScopesGuard` exist from IMP-008. If so, apply them to
`ProjController` by adding `@UseGuards(JwtAuthGuard, ScopesGuard)` and
`@Scopes('proj:read'|'proj:write'|'proj:delete')` decorators per route. If not, create in
`src/infrastructure/auth/`.

---

### Prioridade 6 -- LGPD erasure cascade

Status: pendente

#### Objetivo / Resultado esperado

Three erasure port stubs (PUB/COMP/IMP). `DeleteProjetoEditorialUseCase` orchestrating leaf-first
idempotent cascade. `DELETE /projetos/{id}` returning 204 on success, 502 on any port failure.
`ProjectDeleted` event emitted after commit.

#### Issues vinculadas
- PROJ-015 (erasure port stubs)
- PROJ-016 (DeleteProjetoEditorialUseCase leaf-first orchestration)
- PROJ-INT-004 (ManuscriptErasurePort real adapter → IMP)
- PROJ-INT-005 (CompositionErasurePort real adapter → COMP)
- PROJ-INT-006 (PublicationErasurePort real adapter → PUB)

#### Specs cobertas
- SPEC-11 (cross-context-deletion-lgpd-erasure)
- api-contract §4.6

#### Sequencia de execucao
- Fase 1: PROJ-015 (stubs — use case depends on them)
- Fase 2: PROJ-016 (use case)
- Fase 3: PROJ-INT-004..006 (real adapters, after sibling modules are scaffolded)

#### Criterios de aceite
- Purge order: PUB → COMP → IMP → DB delete (verified by spy call order in spec)
- PUB purge failure: `projeto_editorial` row NOT deleted; 502 returned
- Retry of a partially-failed delete completes without error (idempotent)

#### Riscos
- Real adapters (PROJ-INT-004..006) require sibling erasure ports to be exported — coordinate
  with IMP/COMP/PUB scaffold phases

#### Instrucao para implementador

Implement PROJ-016 with a strict try/catch around each port call. Do NOT use Promise.all — the
purge must be sequential and stop before step 4 on any failure. The mock call-order assertion in
the spec must use `jest.fn().mockResolvedValue(undefined)` with spy sequence tracking.

---

### Prioridade 7 -- Observability

Status: pendente

#### Objetivo / Resultado esperado

`GET /api/proj/health` returns 200. `X-Correlation-Id` propagated on all responses. `WARN`
log entry emitted with `port=<PortName>` when `degraded=true`.

#### Issues vinculadas
- PROJ-017

#### Specs cobertas
- SPEC-07 (observability-health)

#### Sequencia de execucao
- Fase 1: PROJ-017 (health controller + correlation ID middleware + logger config)

#### Criterios de aceite
- Health 200 when DB reachable; `X-Correlation-Id` always in response header
- `WARN degraded:true port=ManuscriptSummaryPort` captured by logger spy in integration test

#### Riscos
- Correlation ID middleware ordering: must run before all guards and use cases

#### Instrucao para implementador

Check if a shared correlation-ID middleware exists from IMP. If so, register it in `ProjModule`
without duplicating. The `PROJ-017` health indicator uses `@nestjs/terminus` `PrismaHealthIndicator`;
add PROJ-specific indicator if not already present in the monolith health endpoint.

---

### Prioridade 8 -- BDD end-to-end

Status: pendente

#### Objetivo / Resultado esperado

Step definitions for all 8 Cucumber feature files (44 scenarios). Cucumber runner exits 0
(pending is acceptable for steps requiring unavailable infra; error is not).

#### Issues vinculadas
- PROJ-018

#### Specs cobertas
- SPEC-08 (bdd-test-scenarios)
- tests/cucumber/ (8 feature files)

#### Sequencia de execucao
- Fase 1: PROJ-018 (all 8 step definition files + cucumber config)

#### Criterios de aceite
- `pnpm test` Cucumber runner exits 0 for all 8 features
- Logger spy correctly captures `WARN degraded:true port=<PortName>` scenarios
- Port mock call count = 1 for batched library scenarios

#### Riscos
- SPEC-07 logging scenarios are non-standard BDD (they assert logger behavior, not HTTP responses);
  step defs must use `jest.spyOn(logger, 'warn')` pattern

#### Instrucao para implementador

Reference M2.5 handoff warnings: SPEC-07 cls 3/5 require logger spy, not HTTP assertions;
SPEC-10 cls 3 requires port call count assertion, not DB query inspection. Implement these step
definition patterns before the straightforward HTTP/status scenarios.

---

## 3. Dependencias externas

- IMP module: exports `ManuscritoQueryPort` (for PROJ-INT-001) and `ManuscritoErasurePort`
  (for PROJ-INT-004). Also provides stubs in IMP-INT-001 (CreateProjetoEditorialUseCase +
  ProjetoEditorialLookup) that are replaced by PROJ-006.
- COMP module: exports `MetadataQueryPort` (PROJ-INT-002) and `MetadataErasurePort` (PROJ-INT-005).
- PUB module: exports `PublicacaoQueryPort` + `FileStoragePort` (PROJ-INT-003) and
  `PublicacaoErasurePort` (PROJ-INT-006).
- Shared `EmpresaContext`, `JwtAuthGuard`, `ScopesGuard`: check for existing impls from IMP
  before creating new ones.

---

## 4. Restricoes arquiteturais (node stack)

- **eslint-plugin-boundaries**: layer enforcement (`modules` → `domain` → `infrastructure` —
  never skip; `modules` never imports other `modules` directly, only via DI token; see
  `docs/architecture/backend/adr/ADR-001-hexagonal-node.md` node-hexagonal-patterns).
- **Layer boundaries**: `src/modules/proj/` → imports from `src/domain/proj/` (ports, VOs, errors)
  and via DI tokens from `infrastructure/`; never imports sibling module internals (IMP/COMP/PUB
  injected exclusively via DI token).
- **Prisma transactions**: `$transaction` only in the infrastructure layer (repository adapter);
  use cases receive the repository port, not the Prisma client.
- **EmpresaContext**: resolved from JWT claim only (RULE-07); never from request body, path, or
  query param; propagated to all repository and port calls via `AsyncLocalStorage`.
- **Event emission**: post-commit (EventEmitter2 `async` listener) — never inside a transaction.

---

## 5. Referencias

- `docs/architecture/backend/services/proj-service/contracts/api-contract.md` (§4, §6, §7)
- `docs/architecture/backend/services/proj-service/contracts/data-model.md`
- `docs/architecture/backend/services/proj-service/contracts/integration-contracts.md`
- `docs/architecture/backend/services/proj-service/contracts/event-contracts.md`
- `docs/architecture/backend/services/proj-service/spec/backend/SPEC-01..11`
- `docs/architecture/backend/services/proj-service/tests/cucumber/` (8 feature files)
- `docs/architecture/backend/adr/ADR-001-hexagonal-node.md` (shared hexagonal boundary)
- `docs/architecture/backend/adr/ADR-002-modular-monolith.md`
- `docs/architecture/backend/adr/ADR-003-multi-tenancy.md`
- `docs/architecture/backend/services/proj-service/adr/ADR-001-service-boundary.md`
- `docs/architecture/backend/services/proj-service/adr/ADR-002-project-status-authority.md`
- `docs/architecture/backend/services/proj-service/adr/ADR-003-publication-history-read-model.md`
- `docs/architecture/backend/plans/plan-IMP.md` (reference for implementation patterns)
