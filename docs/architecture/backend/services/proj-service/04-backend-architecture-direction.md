<!-- OUTPUT-SCHEMA
- Stack
- Service Boundary
- Package Organization
- Hub Service Dependencies
- External Integrations
- Async vs Sync Decisions
-->

# 04 — Backend Architecture Direction

**Module:** PROJ — Projetos · **Service:** `proj-service` · **Package base:** `@cordele`

## Stack

- **Runtime:** Node.js 22
- **Framework:** NestJS 11.x (IoC container, injection tokens, `@Module` graph)
- **Language:** TypeScript (strict)
- **Package manager / build:** pnpm
- **ORM:** Prisma (typed client over PostgreSQL 16); migrations via `prisma migrate`
- **Persistence:** PostgreSQL 16 (schema-per-tenant)
- **Messaging:** none (`stack.messaging.enabled = false`); in-process events and in-process port calls
  only
- **AI:** none (`ai.hasAi = false`)

There is no Java/Spring here (TECH-001). Projects is pure lifecycle coordination and persistence — it
has no parsing or file-processing dependencies.

## Service Boundary

Projects is a single bounded-context module (`proj`) realized inside the Cordelê **modular monolith**
(shared `modular-monolith`). It is not decomposed and not independently deployed in the POC (local
ADR-001 service-boundary). Its public surface is a set of exported inbound ports:

- `CreateProjectUseCase` — create a project in `rascunho`.
- `AdvanceProjetoStatusUseCase.advanceTo({ projetoId, targetStatus })` — the status-authority port that
  IMP and PUB call in-process (D-C); validates legal transitions and is idempotent.
- `ListProjectsUseCase` / `GetProjectDetailUseCase` — read paths for the library and detail screens.

Other contexts reach Projects only through these ports (shared `hexagonal-node` §5), never through the
`projeto_editorial` table or internal providers. The `proj-service` documentation directory is the home
of this context; physically it is a NestJS module within the single backend application.

## Package Organization

NestJS feature module + shared hexagonal layers (per `docs/architecture/backend/adr/ADR-*-hexagonal-node.md`):

```
src/modules/proj/                proj.module.ts, proj.controller.ts,
                                 create-project.service.ts, advance-status.service.ts,
                                 list-projects.service.ts, project-detail.service.ts, dto/
src/domain/                      projeto-editorial.entity.ts, project-status.vo.ts (transition table),
                                 projeto-editorial.repository.interface.ts,
                                 advance-projeto-status.usecase.ts (inbound port),
                                 publication-history.port.ts
                                 (no @nestjs/*, no @prisma/client here)
src/infrastructure/             persistence/  (Prisma repository + mappers)
                                 read/         (publication-history.adapter.ts → PUB in-process query port)
test/                           proj.e2e-spec.ts + jest-e2e.json
```

Dependency rule: `domain` imports nothing outward; `modules/proj` (application) depends on `domain`;
`infrastructure` implements domain ports and is wired in `ProjModule.providers` via `Symbol` tokens
(`{ provide: PROJETO_EDITORIAL_REPOSITORY, useClass: ... }`,
`{ provide: PUBLICATION_HISTORY, useClass: ... }`). The legal-transition rules live in the
`ProjectStatus` value object, so no adapter or controller re-encodes the lifecycle.

## Hub Service Dependencies

None. Cordelê has no shared "hub" service and no TechLab AI dependency (`ai.hasAi = false`). Projects
depends only on:

- **PostgreSQL** (via Prisma) for the `ProjetoEditorial` aggregate and the `Editora` registry read.
- **Publication (PUB)**, in-process, for the publication-history read view (behind
  `PublicationHistoryPort`).

Cross-context relationships stay in-process: IMP and PUB call `AdvanceProjetoStatusUseCase`; PROJ reads
PUB's publication records; PROJ emits `ProjectCreated` / `ProjectStatusChanged` for interested in-process
listeners.

## External Integrations

- **None external.** No third-party API, no broker, no AI provider, no file storage of its own (Projects
  holds no binaries).
- The only cross-boundary read is `PublicationHistoryPort`, implemented as an adapter over PUB's
  in-process query port. Should Publication later expose history over a different transport, only that
  adapter changes — domain and application layers are untouched.

## Async vs Sync Decisions

- **Create, advance, list and detail run synchronously** within the request (or the in-process call from
  IMP/PUB). Lifecycle operations are short, transactional writes and reads; there is no broker to offload
  to and no long-running work here.
- **Status coordination is a synchronous in-process port call**, not an event subscription: IMP/PUB call
  `advanceTo` and get an authoritative result (applied, no-op, or rejected). This makes the lifecycle
  deterministic and testable in-process, and idempotency covers retries.
- **PROJ's own domain events are dispatched in-process** (NestJS event emitter) after commit; they are
  best-effort notifications (e.g. read-model/UI refresh), not a delivery guarantee and not the mechanism
  that drives status.
- **Future async path (post-POC):** if a broker is enabled, `advanceTo` could be fronted by a command
  message and history could be materialized from PUB events. The port-based boundary makes this an
  adapter/orchestration change, not a domain change. Recorded as an assumption, not a commitment (doc 06).
