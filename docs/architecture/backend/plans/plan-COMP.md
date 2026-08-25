# Plano -- COMP (comp-service, Composição Editorial)

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

`comp-service` is the **Composition** module of the Cordelê modular monolith: it owns the
`Metadados` and `ConfiguracaoLayout` aggregates — the editorial identity and layout parameters
of a project — and is the **sole authority** over those entities. It orchestrates cover
management via `FileStoragePort`, exposes image-alignment overrides via `ManuscriptContentPort`
(read-only from IMP), and exports in-process ports to PUB (metadata + layout for ePub export)
and to PROJ (batched author lookup + LGPD erasure cascade step 2).

Key architectural constraints:
- **COMP never touches `projeto_editorial`** — it reads the project id from the JWT claim but
  never writes or advances project status (ADR-002 service boundary). Status authority is PROJ.
- **Two aggregates, lazy defaults (D-M):** `Metadados` and `ConfiguracaoLayout` are separate
  rows, each 1:1 with a project, materialised on the first `PUT` (GET before PUT returns default
  with `materialized=false`, never 404).
- **Overrides are parameters, not content edits (ADR-002):** `LayoutOverride` references IMP
  content tree nodes read-only via `ManuscriptContentPort`; COMP never writes IMP data. Only
  `tipo=imagem` (alignment) overrides are persisted in the MVP; `em-branco` is reserved in the
  enum but rejected (422) at the application layer (D-H).
- **Preview = data (D-K):** `GET preview-context` returns the content tree + layout + overrides
  as data for the SPA to render client-side. Nothing rendered is stored or returned as pixels.
- **All cross-context integrations are in-process** (`messaging.enabled=false`): PUB and PROJ
  call COMP's exported DI providers; the cover binary lives in `FileStoragePort` (disk/S3).

### MVP scope

Configure metadata (titulo/autor/idioma) → upload/remove cover → configure layout (typography +
margins + headings) → add/remove image-alignment overrides → assemble preview-context for T06 →
export in-process: PUB reads metadata + layout; PROJ reads author and calls purge on delete.

### Diagnóstico inicial (gaps mapeados em doc 06)

- **A1 (schema-per-tenant):** declared in `project-context.json`; BA POC was single-tenant.
  Decision issue COMP-002 must be resolved before scaffold (migrations + Prisma adapter).
- **G4 (stale override reconciliation):** MVP validates on write + marks stale on read (no
  override history, no automatic removal on re-import — reads mark stale, PUB excludes them).
- **G8 (tenant provisioning):** shared platform concern; COMP contributes DDL V0001..V0003 to
  the provisioning script (INT-COMP-006, Opção A only).
- **R5 (orphaned covers):** replaced covers leave orphaned objects in `FileStoragePort`; a
  cleanup routine is a future concern (noted in data-model.md §5, not in this backlog).

---

## 1. Estratégia geral

### Objetivo macro

Deliver a compilable, testable NestJS `CompModule` with full metadata/layout orchestration,
schema-per-tenant persistence, FileStoragePort-backed cover management, ManuscriptContentPort-gated
override validation, exported in-process ports for PUB and PROJ, JWT security, and BDD coverage
— in 8 priorities that the `be-implement` agent can execute one at a time.

### Ordem das prioridades

| P | Título | Motivo |
|---|---|---|
| P1 | Scaffold + decisão A1 | Module must compile; multi-tenancy decision gates DDL and Prisma adapter |
| P2 | Domain + use cases core | Pure domain aggregates + golden-path use cases (metadata, cover, layout, preview) |
| P3 | Persistence + migrations | Prisma schema, repositories, schema-per-tenant targeting; FK ON DELETE CASCADE |
| P4 | Infra adapters (IMP stub + storage) | ManuscriptContentPort stub and FileStoragePort disk adapter unlock integration testing |
| P5 | Security | JWT guard + EmpresaContext — needed for integration testing and BDD |
| P6 | Exported ports (PUB + PROJ) | In-process ports that PUB and PROJ depend on; real IMP adapter and S3 go here |
| P7 | Observability | Correlation middleware + health endpoint + metrics counters |
| P8 | BDD end-to-end | Step definitions for all 8 Cucumber feature files |

---

## 2. Plano por prioridade

### Prioridade 1 -- Scaffold + decisão multi-tenancy

Status: pendente

#### Objetivo / Resultado esperado

`CompModule` compiles with all 7 REST routes registered under `/api/comp/projetos/:id/...`,
`pnpm build` exits 0. Multi-tenancy strategy (Opção A schema-per-tenant vs Opção B single-schema)
decided and documented so DDL and Prisma adapter in P3 can be generated correctly.

#### Issues vinculadas
- COMP-001
- COMP-002

#### Specs cobertas
- SPEC-01 (api-surface — routes, DI tokens)

#### Sequencia de execucao
- Fase 1: Create `CompModule` + `CompController` (7 routes, stub responses)
- Fase 2: Resolve A1 decision (COMP-002) and document outcome
- Fase 3: Controller spec verifying all 7 routes and DI token declarations

#### Criterios de aceite
- `pnpm build` exits 0 with CompModule present
- All 7 routes registered (verified by controller unit test)
- A1 decision documented before COMP-009/COMP-012 begin

#### Riscos
- DI token naming collision with IMP or PROJ tokens — prefix all tokens with `COMP_`

#### Instrucao para implementador

Create `src/modules/comp/` following the same pattern as `src/modules/proj/` (IMP or PROJ as
reference). DI tokens go in `src/modules/comp/comp.tokens.ts`. Routes follow api-contract §4
(nested under `/api/comp/projetos/:projetoId/`). Guards wired as allow-all stubs in P1 (real
JWT guard comes in P5). For COMP-002: read `project-context.json` `multiTenancy` block, compare
with BA POC setup, and document chosen option.

---

### Prioridade 2 -- Domain + use cases (metadata, cover, layout, preview)

Status: pendente

#### Objetivo / Resultado esperado

All 7 use cases and the 4 domain aggregates/entities implemented and unit-tested. The golden
paths for metadata upsert, cover upload/remove, layout upsert with override validation, and
preview-context assembly are all exercisable with mocked repositories/ports.

#### Issues vinculadas
- COMP-003
- COMP-004
- COMP-005
- COMP-006
- COMP-007
- COMP-008

#### Specs cobertas
- SPEC-02 (metadata + cover)
- SPEC-03 (layout + overrides + preview)
- SPEC-05 (idempotency)

#### Sequencia de execucao
- Fase 1: Domain aggregates + VOs (COMP-003, COMP-006 — no external deps)
- Fase 2: Metadata use cases (COMP-004, COMP-005) — depend on COMP-003
- Fase 3: Layout use cases (COMP-007, COMP-008) — depend on COMP-006

#### Criterios de aceite
- All use case unit specs pass with mocked repositories/ports
- DomainException propagated from VOs reaches controller as 400
- `em-branco` override type rejected with 422 at UpdateLayoutUseCase
- Lazy default: GET before PUT returns `materialized=false` without DB write

#### Riscos
- ManuscriptContentPort interface (COMP-007) must be declared before COMP-008 depends on it — ensure ordering within P2

#### Instrucao para implementador

Domain first: write COMP-003 (Metadados VO) and COMP-006 (ConfiguracaoLayout VO) before any
use case. Port interfaces (MetadadosRepository, ConfiguracaoLayoutRepository, ManuscriptContentPort,
FileStoragePort) declared in use case issues; real adapters come in P3/P4. Use Jest mocks for
ports in P2 specs. Concurrency note from SPEC-05.C5: no explicit lock needed — `UNIQUE(projeto_id)`
DB constraint serializes writes; document this as a comment in UpdateMetadadosUseCase and UpdateLayoutUseCase.

---

### Prioridade 3 -- Persistence + migrations

Status: pendente

#### Objetivo / Resultado esperado

Prisma schema + 3 migrations (V0001..V0003) applied. MetadadosRepository and ConfiguracaoLayoutRepository
adapters functional. EmpresaContext schema targeting wired (if Opção A). FK ON DELETE CASCADE
from metadados and configuracao_layout to projeto_editorial present in DDL.

#### Issues vinculadas
- COMP-009
- COMP-010
- COMP-011
- COMP-012
- INT-COMP-006 (provisioning script, Opção A only)

#### Specs cobertas
- SPEC-04 (data model + migrations)
- SPEC-05 (idempotency — upsert semantics)

#### Sequencia de execucao
- Fase 1: COMP-009 — Prisma schema + migrations (requires COMP-002 decision)
- Fase 2: COMP-010 + COMP-011 — repository adapters
- Fase 3: COMP-012 — EmpresaContext schema targeting
- Fase 4: INT-COMP-006 — provisioning script (Opção A)

#### Criterios de aceite
- `pnpm prisma migrate dev` exits 0 with all 3 migrations applied
- FK ON DELETE CASCADE present (SPEC-04.C6)
- ConfiguracaoLayoutRepository override replacement is atomic (single transaction)

#### Riscos
- PROJ must be migrated before COMP in shared DBs (FK dependency on `projeto_editorial`)
- Prisma single-schema assumption conflicts with schema-per-tenant (Opção A) — runtime search_path override in COMP-012

#### Instrucao para implementador

Take the canonical SQL blocks from `contracts/data-model.md` §2.1–§2.3 verbatim — do not
re-derive. CHECK constraints must be raw SQL in the migration files (Prisma does not generate
them). For COMP-012: wrap PrismaClient with `$executeRawUnsafe('SET search_path = emp_' + slug)`
before each request context; validate slug with `[a-z][a-z0-9_]{1,30}` before interpolation.

---

### Prioridade 4 -- Infra adapters (ManuscriptContentPort stub + FileStoragePort disk)

Status: pendente

#### Objetivo / Resultado esperado

ManuscriptContentPort stub (COMP-014) and FileStoragePort disk adapter (COMP-015) in place.
Preview-context assembly (COMP-008) and cover upload (COMP-005) work end-to-end against real
storage/fixture content tree. INT-COMP-001 and INT-COMP-002 wire the real IMP adapter and S3
adapter once their dependencies exist.

#### Issues vinculadas
- COMP-014
- COMP-015
- INT-COMP-001 (real IMP adapter — when IMP scaffold ready)
- INT-COMP-002 (S3 adapter — when S3 config available)

#### Specs cobertas
- SPEC-10 (integrations — ManuscriptContentPort, FileStoragePort)

#### Sequencia de execucao
- Fase 1: COMP-014 (stub), COMP-015 (disk) — no external deps beyond port interfaces
- Fase 2: INT-COMP-001 (real IMP, after IMP-010 or equivalent exists)
- Fase 3: INT-COMP-002 (S3, when prod env configured)

#### Criterios de aceite
- Cover upload stores binary on disk; `capaUrl` reference saved in DB
- Preview-context returns fixture tree from stub adapter
- Stub-to-real swap is a single module registration change (no use case modification)

#### Riscos
- IMP query port interface must match `ManuscriptContentPort` exactly; coordinate naming with IMP scaffold

#### Instrucao para implementador

For COMP-014 stub: make the "no-manuscript" project id configurable via `COMP_STUB_NO_MANUSCRIPT_IDS`
env var (comma-separated UUIDs) so BDD tests can exercise the 409 path without modifying code.
For COMP-015 disk adapter: use Node `fs/promises` and stream the buffer; ensure `COMP_STORAGE_DIR`
is created if absent (mkdirp).

---

### Prioridade 5 -- Security (JWT guard + EmpresaContext)

Status: pendente

#### Objetivo / Resultado esperado

All 7 COMP routes protected by JWT guard + scope guard. `EmpresaContext` populated from JWT
`empresa` claim before any use case or repository call. Cross-tenant projetoId returns 404.

#### Issues vinculadas
- COMP-013

#### Specs cobertas
- SPEC-06 (security — JWT, scopes, tenant isolation, LGPD)

#### Sequencia de execucao
- Fase 1: COMP-013 — JWT guard + ScopeGuard + EmpresaContext population

#### Criterios de aceite
- Unauthenticated request → 401; missing scope → 403
- Cross-tenant projetoId → 404 (use case verifies empresa via EmpresaContext, not guard)
- `EmpresaContext` populated before COMP-012 Prisma adapter reads it

#### Riscos
- JwkSet caching must be configured (avoid fetching on every request)
- EmpresaContext middleware ordering relative to JWT guard — JWT guard must run before EmpresaContext propagation

#### Instrucao para implementador

Check if a shared `JwtAuthGuard` exists in the monolith (PROJ already implemented one) and
reuse it rather than creating a duplicate. If `ScopeGuard` exists in PROJ, import from shared
utilities. Apply guards at controller level, not globally, to avoid scope pollution across modules.

---

### Prioridade 6 -- Exported ports (PUB + PROJ integration)

Status: pendente

#### Objetivo / Resultado esperado

COMP's four inbound ports exported from `CompModule` and injectable by PUB and PROJ: `GetMetadadosUseCase`,
`GetConfiguracaoLayoutUseCase`, `ProjectMetadataPort`, `CompositionErasurePort`. Integration
tests validate the contracts end-to-end.

#### Issues vinculadas
- COMP-016
- COMP-017
- INT-COMP-003 (COMP→PUB)
- INT-COMP-004 (COMP→PROJ library)
- INT-COMP-005 (COMP→PROJ erasure)

#### Specs cobertas
- SPEC-10 (integrations — all 4 inbound ports)
- `contracts/integration-contracts.md` §1

#### Sequencia de execucao
- Fase 1: COMP-016 + COMP-017 — implement and export use cases
- Fase 2: INT-COMP-003 — PUB wiring (after PUB scaffold)
- Fase 3: INT-COMP-004 + INT-COMP-005 — PROJ wiring (after PROJ-009/PROJ-015 stubs exist)

#### Criterios de aceite
- PUB can inject `GET_METADADOS_PORT` and `GET_CONFIGURACAO_LAYOUT_PORT` without HTTP
- PROJ can inject `PROJECT_METADATA_PORT` with single-batch semantics (no N+1)
- `CompositionErasurePort.purge` idempotent when called twice

#### Riscos
- GetConfiguracaoLayout must exclude stale overrides — re-validate `nodeExists` at export time (uses ManuscriptContentPort, which must be real or stub-able)
- PUB scaffold may not exist when COMP P6 is executed — use PROJ's stub pattern (INT-COMP-003 follows INT-COMP-004 if needed)

#### Instrucao para implementador

Export ports by DI token from `CompModule.exports` array. PUB and PROJ import `CompModule` in
their respective module files. The batched `metadata(projetoIds)` query must use Prisma
`findMany({ where: { projetoId: { in: [...] } } })` — never a loop of `findUnique`.

---

### Prioridade 7 -- Observabilidade + health

Status: pendente

#### Objetivo / Resultado esperado

`GET /api/comp/health` exposed; `X-Correlation-Id` echoed on all responses; JSON structured
logs per request; operation counters for all 4 operation types; RFC 7807 error format.

#### Issues vinculadas
- COMP-018
- COMP-019

#### Specs cobertas
- SPEC-07 (observability — correlation, health, counters, degradation)

#### Sequencia de execucao
- Fase 1: COMP-018 — correlation middleware + structured logging + RFC 7807 filter
- Fase 2: COMP-019 — health endpoint + metrics service

#### Criterios de aceite
- X-Correlation-Id echoed on every COMP response (generated if absent)
- Storage unavailable → health returns 200 degraded (not 503)
- DB unavailable → health returns 503 fail
- Metrics counters incremented correctly per operation type

#### Riscos
- Middleware ordering: correlation middleware must run before exception filter so traceId is available in error responses

#### Instrucao para implementador

Check if a shared correlation middleware exists in the monolith (IMP or PROJ may have one).
If so, reuse it. The `CompMetricsService` should be a singleton scoped to the request module;
use a simple in-process Map counter (not Prometheus client) for the POC — the interface is the
same to swap later.

---

### Prioridade 8 -- BDD end-to-end

Status: pendente

#### Objetivo / Resultado esperado

All 8 Cucumber feature files covered by step definitions; 48 test items (44 scenarios + 4
Scenario Outlines) pass against a test DB with provisioned tenant schema.

#### Issues vinculadas
- COMP-020

#### Specs cobertas
- SPEC-08 (BDD — full feature list, 8 features, 44+4 scenarios)

#### Sequencia de execucao
- Fase 1: Configure Cucumber runner + NestJS test app harness + test DB provisioning
- Fase 2: Implement step definitions per feature file (metadata → cover → layout → preview → idempotency → security → boundary → observability)

#### Criterios de aceite
- `pnpm test --testPathPattern=comp.e2e` exits 0 for all 48 test items
- No undefined Cucumber steps
- Test DB tenant schema provisioned and torn down per scenario (or suite)

#### Riscos
- Test DB must have `projeto_editorial` seeded before COMP scenarios (FK dependency)
- ManuscriptContentPort stub (COMP-014) used for BDD; stale override scenario requires configured no-manuscript id

#### Instrucao para implementador

Use the same Cucumber runner configuration as IMP (if already configured). Provision `emp_test`
tenant schema in a `beforeAll` hook; seed a reference `projeto_editorial` row for all COMP
scenarios. Use `COMP_STUB_NO_MANUSCRIPT_IDS` env var to configure the no-manuscript project id
for preview-context BDD scenarios.

---

## 3. Dependencias externas

| Contexto | O que COMP precisa | Quando |
|---|---|---|
| PROJ | `projeto_editorial` migration must run before COMP migrations (FK) | P3 |
| IMP | `ManuscritoQueryPort` in-process query port (for INT-COMP-001) | P4 (real adapter) |
| PUB scaffold | `PubModule` must exist for INT-COMP-003 injection | P6 |
| PROJ stub ports | PROJ-009 (`ManuscriptSummaryPort`) and PROJ-015 stubs must exist for INT-COMP-004/005 | P6 |

---

## 4. Restricoes arquiteturais (Node stack)

- `eslint-plugin-boundaries` enforces hexagonal layer boundaries (see standards `node-hexagonal-patterns`):
  `modules/` may depend on `application/`; `application/` may depend on `domain/` and `ports/`;
  `infrastructure/` may depend on `ports/`; cross-layer imports in the wrong direction are linting errors.
- Prisma `$transaction` is the **only** mechanism for multi-row atomic writes — no application-level
  locking (SPEC-05.C5: UNIQUE serializes concurrent writes).
- `EmpresaContext` is the **sole** source of `empresa` slug/id — never from path/query/body (SPEC-06).
- COMP never calls `advanceTo`, never writes `projeto_editorial`, never imports IMP write ports (ADR-002).
- All responses on error must use RFC 7807 `application/problem+json` with `traceId = X-Correlation-Id`.

---

## 5. Referencias

- `docs/architecture/backend/services/comp-service/comp-service-spec.md`
- `docs/architecture/backend/services/comp-service/contracts/api-contract.md`
- `docs/architecture/backend/services/comp-service/contracts/data-model.md`
- `docs/architecture/backend/services/comp-service/contracts/integration-contracts.md`
- `docs/architecture/backend/services/comp-service/contracts/event-contracts.md`
- `docs/architecture/backend/services/comp-service/spec/backend/SPEC-01..10.md`
- `docs/architecture/backend/services/comp-service/generator-config.yml`
- `docs/architecture/backend/adr/ADR-001-hexagonal-node.md`
- `docs/architecture/backend/adr/ADR-002-modular-monolith.md`
- `docs/architecture/backend/adr/ADR-003-multi-tenancy.md`
- `docs/architecture/backend/issues/issues_map-COMP.md`
