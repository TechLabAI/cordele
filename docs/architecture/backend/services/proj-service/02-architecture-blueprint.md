<!-- OUTPUT-SCHEMA
- System Boundary
- External Actors and Systems
- End-to-End Flows
- Internal Boundaries
- Cross-cutting Concerns
-->

# 02 — Architecture Blueprint

**Module:** PROJ — Projetos · **Service:** `proj-service` · **Stack:** NestJS 11 + Prisma + PostgreSQL 16

## System Boundary

Projects is a bounded-context NestJS module (`proj`) inside the Cordelê modular monolith (shared
`modular-monolith`). It is responsible for everything about a project's *identity and lifecycle*: from
"a project is created" to "a project's status reflects the latest work done on it", plus the two
cross-title views an editor manages — the library and the publication history.

Inside the boundary:
- Creating a `ProjetoEditorial` and holding its authoritative `status`.
- Validating and applying status transitions requested by other contexts through the inbound port.
- Listing projects for the tenant and serving a single project's detail.
- Assembling the publication-history read view from Publication's records.

Outside the boundary (referenced or read, never owned here):
- `Manuscrito` and its content tree — owned by Import (IMP).
- `Metadados` / `ConfiguracaoLayout` — owned by Composition (COMP).
- `Publicacao` and ePub artifacts — owned by Publication (PUB).
- `Editora` (tenant registry) — lives in `cordele_global`.

## External Actors and Systems

- **Coordenador(a) Editorial** — creates projects and browses the library / project detail through the
  Angular frontend.
- **Cordelê BFF (NestJS)** — the single entry point (TECH-003); Projects is reached only through it.
- **Import (IMP), Publication (PUB)** — *in-process* callers of PROJ's `AdvanceProjetoStatusUseCase`:
  IMP requests `em_composicao` after a manuscript is imported (D-C); PUB requests `publicado` or
  `com_erros` after an export. They call the port; they never write `projeto_editorial`.
- **Publication (PUB)** — also the source of publication history: PROJ reads `Publicacao` records
  through an in-process query port owned by PUB.
- **PostgreSQL 16** — persists `ProjetoEditorial` in the tenant schema; reads the `Editora` registry
  from `cordele_global`.
- **No message broker** — `stack.messaging.enabled = false`. Cross-context coordination is synchronous
  in-process port calls; PROJ's own domain events are in-process only.
- **No external APIs and no AI provider.**

## End-to-End Flows

**Golden path — create and drive a project through its lifecycle**

1. On the library screen (T01) the editor creates a project (name + tenant); within the active
   `EmpresaContext`, PROJ persists a `ProjetoEditorial` in `rascunho` and emits `ProjectCreated`.
2. The editor uploads a manuscript (IMP context). On success IMP calls
   `AdvanceProjetoStatusUseCase.advanceTo({ projetoId, targetStatus: 'em_composicao' })`. PROJ validates
   `rascunho → em_composicao`, applies it, and emits `ProjectStatusChanged`.
3. Composition (COMP) sets metadata and layout against the same `projetoId`; PROJ status is unchanged
   (still `em_composicao`).
4. Publication (PUB) exports and validates an ePub, then calls `advanceTo` with `publicado` (epubcheck
   `valido`/`avisos`) or `com_erros` (epubcheck `erros_criticos`). PROJ validates the transition and
   emits `ProjectStatusChanged`.
5. The editor opens project detail: current status, the imported-manuscript summary (by reference), and
   the publication history read from PUB (T07).

**Alternative — illegal transition:** a requested `targetStatus` that is not reachable from the current
status (e.g. `rascunho → publicado` with no manuscript) is rejected with a typed domain error; status is
unchanged.

**Alternative — idempotent replay:** `advanceTo` requesting a status the project has already reached or
passed is a no-op and returns success, so a retried in-process call never regresses or corrupts state.

**Alternative — recovery from error:** a project in `com_erros` returns to `em_composicao` when a new
composition/export cycle begins, so the editor can fix and re-export.

## Internal Boundaries

Hexagonal layering per the shared `hexagonal-node` ADR, directories as layers, the `proj` module as the
bounded context:

- **domain/** — the `ProjetoEditorial` aggregate, the `ProjectStatus` value object and the legal
  **transition table** (pure lifecycle rules), plus ports: inbound `CreateProjectUseCase`,
  `AdvanceProjetoStatusUseCase`, `ListProjectsUseCase`, `GetProjectDetailUseCase`; outbound
  `ProjetoEditorialRepositoryPort` and `PublicationHistoryPort` (read view over PUB). No `@nestjs/*`, no
  `@prisma/client` here.
- **modules/proj/** (application) — `ProjModule`, the controller, and the use-case services that
  orchestrate create / advance / list / detail. The transaction boundary and event emission live here.
- **infrastructure/** — Prisma repository adapter + mappers for `ProjetoEditorial`, and the adapter that
  implements `PublicationHistoryPort` by calling PUB's in-process query port. Bound to domain ports via
  `Symbol` DI tokens in the module's `providers`.

The dependency rule points inward: persistence and the PUB read adapter depend on domain contracts,
never the reverse. `AdvanceProjetoStatusUseCase` is exported so IMP and PUB depend only on that port
(shared `hexagonal-node` §5), not on PROJ internals.

## Cross-cutting Concerns

- **Multi-tenancy (shared `multi-tenancy`).** `EmpresaContext` (AsyncLocalStorage, RULE-07) carries the
  tenant; the Prisma adapter targets `emp_<slug>`, with the `Editora` registry in `cordele_global`. No
  project of another tenant is reachable; `advanceTo` operates only within the caller's context.
- **Status integrity.** The legal-transition graph and idempotency are enforced in the domain, so status
  cannot reach an invalid value regardless of caller order or retries.
- **Confidentiality & LGPD (`compliance.lgpd = true`).** A project groups sensitive creative work;
  deleting a project must cascade to its manuscripts, layout and publications across contexts — a
  cross-context concern surfaced in doc 06.
- **Observability.** Structured logs and pipeline events for create and each transition, correlated by
  `trace_id`; a status change records `from`, `to` and the requesting context.
- **Validation & error handling.** Typed domain errors for illegal transitions and missing projects,
  raised before any side effect.
