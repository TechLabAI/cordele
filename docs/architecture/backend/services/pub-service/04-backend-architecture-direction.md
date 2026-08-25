<!-- OUTPUT-SCHEMA
- Stack
- Service Boundary
- Package Organization
- Hub Service Dependencies
- External Integrations
- Async vs Sync Decisions
-->

# 04 — Backend Architecture Direction

**Module:** PUB — Publicação · **Service:** `pub-service` · **Package base:** `@cordele`

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
- **ePub assembly:** in-process TypeScript builder producing an OCF/ePub 3 package (OPF manifest, spine,
  nav document, XHTML content, images, CSS derived from the layout config), packed as a ZIP/OCF container.
- **Validation:** **epubcheck** (W3C, Java CLI/JAR) invoked through an adapter — the only Java in the
  picture, and it is an external tool, not a service dependency (TECH-001 stands for the service code).

## Service Boundary

Publication is a single bounded-context module (`pub`) realized inside the Cordelê **modular monolith**
(shared `modular-monolith`). It is not decomposed and not independently deployed in the POC (local
ADR-001 service-boundary). Its public surface is a set of exported inbound ports:

- `GeneratePublicationUseCase.generate({ projetoId })` — enqueue a build, return `publicacaoId`.
- `GetPublicationStatusUseCase` — poll status + report.
- `DownloadPublicationUseCase` — stream the stored `.epub`.
- `ListPublicationsForProject` — the query port PROJ calls in-process for its history view.

Other contexts reach Publication only through these ports (shared `hexagonal-node` §5), never through the
`publicacao` table or internal providers. Physically it is a NestJS module within the single backend
application.

## Package Organization

NestJS feature module + shared hexagonal layers (per `docs/architecture/backend/adr/ADR-*-hexagonal-node.md`):

```
src/modules/pub/                 pub.module.ts, pub.controller.ts,
                                 generate-publication.service.ts, get-publication-status.service.ts,
                                 download-publication.service.ts, list-publications.service.ts,
                                 publication-build.job.ts (async orchestration), dto/
src/domain/                      publicacao.entity.ts, publication-status.vo.ts (transition table),
                                 validation-report.vo.ts, epub-builder.domain-service.ts,
                                 publicacao.repository.interface.ts,
                                 epub-validation.port.ts, file-storage.port.ts,
                                 manuscript-content.port.ts, composition-read.port.ts,
                                 project-status.port.ts
                                 (no @nestjs/*, no @prisma/client, no fs here)
src/infrastructure/             persistence/  (Prisma repository + mappers)
                                 validation/   (epubcheck.adapter.ts → EpubValidationPort)
                                 storage/      (file-storage.adapter.ts → FileStoragePort)
                                 read/         (manuscript.adapter.ts → IMP, composition.adapter.ts → COMP)
                                 status/       (project-status.adapter.ts → PROJ advanceTo)
test/                           pub.e2e-spec.ts + jest-e2e.json
```

Dependency rule: `domain` imports nothing outward; `modules/pub` (application) depends on `domain`;
`infrastructure` implements domain ports and is wired in `PubModule.providers` via `Symbol` tokens
(`{ provide: PUBLICACAO_REPOSITORY, useClass: ... }`, `{ provide: EPUB_VALIDATION, useClass: ... }`,
`{ provide: FILE_STORAGE, useClass: ... }`, `{ provide: PROJECT_STATUS, useClass: ... }`). The
`gerando → validando → publicado | com_erros` rules live in the `PublicationStatus` value object; the OPF
/ spine / nav assembly lives in the `EpubBuilder` domain service, so no adapter re-encodes either.

## Hub Service Dependencies

None. Cordelê has no shared "hub" service and no TechLab AI dependency (`ai.hasAi = false`). Publication
depends only on:

- **PostgreSQL** (via Prisma) for the `Publicacao` aggregate.
- **IMP**, in-process, for the manuscript content tree (`ManuscriptContentPort`, read-only).
- **COMP**, in-process, for metadata and layout (`GetMetadados` / `GetConfiguracaoLayout`, read-only).
- **PROJ**, in-process, to request the terminal project status (`AdvanceProjetoStatusUseCase.advanceTo`).

All four cross-context relationships stay in-process; PUB writes none of their tables. PUB also *exposes*
`ListPublicationsForProject`, which PROJ calls for its history view.

## External Integrations

- **epubcheck** — the W3C ePub 3 validator (Java CLI/JAR), reached through `EpubValidationPort`. Its
  verdict is authoritative for `publicado` vs `com_erros`; its report is persisted. The domain knows a
  *validation verdict*, not a Java process (local ADR-003). In the POC the bundled tool runs as a child
  process; a hosted validation service would be a different adapter behind the same port.
- **File storage** — the generated `.epub` binary is stored behind `FileStoragePort` (local disk POC /
  S3-compatible prod), the same port pattern IMP and COMP established. Tables hold a reference, not bytes.
- No third-party API, no broker, no AI provider.

## Async vs Sync Decisions

- **The build runs asynchronously in-process** (local ADR-002). `GeneratePublicationUseCase.generate`
  creates the `Publicacao` in `gerando`, enqueues an in-process job, and returns a `publicacaoId`
  immediately (HTTP 202). Assembly + epubcheck are long-running and must not block the request thread.
- **Status is observed by polling** `GetPublicationStatusUseCase`; with no broker and `messaging.enabled
  = false`, there is no push channel — polling is the deliberate POC mechanism.
- **The in-process reads (IMP/COMP) and the `PROJ.advanceTo` call are synchronous** inside the job. The
  job reads inputs, assembles, validates, persists the outcome, then requests the project-status change
  and gets an authoritative result; `advanceTo` idempotency covers retries.
- **PUB's own domain events are dispatched in-process** after commit; they are best-effort notifications
  (UI/read-model refresh), not the mechanism that changes project status.
- **Concurrency:** at most one non-terminal `Publicacao` per project; a re-trigger while a build is in
  flight returns the existing `publicacaoId` rather than starting a second job.
- **Future async path (post-POC):** if a broker is enabled, the build could be dispatched as a command
  message and status pushed to clients; because the boundary is port-based, that is an
  adapter/orchestration change, not a domain change. Recorded as an assumption, not a commitment (doc 06).
