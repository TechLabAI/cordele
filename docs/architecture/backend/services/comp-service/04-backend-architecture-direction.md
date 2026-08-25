<!-- OUTPUT-SCHEMA
- Stack
- Service Boundary
- Package Organization
- Hub Service Dependencies
- External Integrations
- Async vs Sync Decisions
-->

# 04 — Backend Architecture Direction

**Module:** COMP — Composição · **Service:** `comp-service` · **Package base:** `@cordele`

## Stack

- **Runtime:** Node.js 22
- **Framework:** NestJS 11.x (IoC container, injection tokens, `@Module` graph)
- **Language:** TypeScript (strict)
- **Package manager / build:** pnpm
- **ORM:** Prisma (typed client over PostgreSQL 16); migrations via `prisma migrate`
- **Persistence:** PostgreSQL 16 (schema-per-tenant)
- **File storage:** local disk (POC) / S3-compatible (prod) behind `FileStoragePort` — for the cover image
- **Messaging:** none (`stack.messaging.enabled = false`); in-process events and in-process port calls only
- **AI:** none (`ai.hasAi = false`)

There is no Java/Spring here (TECH-001). Composition is configuration + validation + a read-only preview
over IMP's content — it has no parsing, build or AI dependencies.

## Service Boundary

Composition is a single bounded-context module (`comp`) realized inside the Cordelê **modular monolith**
(shared `modular-monolith`). It is not decomposed and not independently deployed in the POC (local
ADR-001 service-boundary). Its public surface is a set of exported ports:

- `UpdateMetadadosUseCase` — create/update a project's metadata, including cover upload.
- `UpdateLayoutUseCase` — create/update a project's layout (typography + page/image overrides).
- `GetLayoutPreviewUseCase` — assemble a read-only preview from the manuscript content tree + layout.
- `GetMetadadosUseCase` / `GetConfiguracaoLayoutUseCase` — the read ports PUB calls at export time.

Other contexts reach Composition only through these ports (shared `hexagonal-node` §5), never through the
`metadados` / `configuracao_layout` tables. The `comp-service` documentation directory is the home of
this context; physically it is a NestJS module within the single backend application.

## Package Organization

NestJS feature module + shared hexagonal layers (per `docs/architecture/backend/adr/ADR-*-hexagonal-node.md`):

```
src/modules/comp/                comp.module.ts, comp.controller.ts,
                                 update-metadados.service.ts, update-layout.service.ts,
                                 upload-cover.service.ts, layout-preview.service.ts,
                                 get-metadados.service.ts, get-layout.service.ts, dto/
src/domain/                      metadados.entity.ts, configuracao-layout.entity.ts,
                                 idioma.vo.ts, alinhamento.vo.ts, layout-override.ts,
                                 metadados.repository.interface.ts,
                                 configuracao-layout.repository.interface.ts,
                                 file-storage.port.ts, manuscript-content.port.ts (read-only)
                                 (no @nestjs/*, no @prisma/client here)
src/infrastructure/             persistence/  (Prisma repositories + mappers)
                                 storage/      (file-storage.adapter.ts → disk/S3)
                                 read/         (manuscript-content.adapter.ts → IMP in-process port)
test/                           comp.e2e-spec.ts + jest-e2e.json
```

Dependency rule: `domain` imports nothing outward; `modules/comp` (application) depends on `domain`;
`infrastructure` implements domain ports and is wired in `CompModule.providers` via `Symbol` tokens
(`{ provide: METADADOS_REPOSITORY, useClass: ... }`, `{ provide: FILE_STORAGE, useClass: ... }`,
`{ provide: MANUSCRIPT_CONTENT, useClass: ... }`). Validation and layout-range rules live in the domain
value objects, so no controller or adapter re-encodes them.

## Hub Service Dependencies

None. Cordelê has no shared "hub" service and no TechLab AI dependency (`ai.hasAi = false`). Composition
depends only on:

- **PostgreSQL** (via Prisma) for the `Metadados` and `ConfiguracaoLayout` aggregates.
- **File storage** (via `FileStoragePort`) for the cover binary.
- **Import (IMP)**, in-process, for a read-only view of the manuscript content tree (behind
  `ManuscriptContentPort`) used by the preview.

Its own configuration is consumed by **Publication (PUB)**, which calls COMP's `GetMetadados` /
`GetConfiguracaoLayout` ports in-process. COMP does not depend on PROJ at runtime beyond the `projetoId`
it is keyed to — it never calls PROJ's `advanceTo`.

## External Integrations

- **File storage** — the only infrastructure integration: `FileStoragePort` (local disk POC /
  S3-compatible prod) for the cover image; COMP keeps `capaUrl`, not the bytes (local ADR-003).
- **None else external** — no third-party API, no broker, no AI provider. `isbn`, `categoria` and
  `editoraNome` are `source: mock` (BA), so there is no ISBN registry or taxonomy service in the POC;
  should one be added later, it enters behind a new outbound port without touching the domain.

## Async vs Sync Decisions

- **Metadata and layout updates run synchronously** within the request. They are short, transactional
  writes; there is no broker to offload to and no long-running work here.
- **Cover upload is synchronous**: the binary is streamed to `FileStoragePort`, the reference is stored,
  and `Metadados` is persisted in the same request. (If large-file handling later needs it, the upload can
  move behind an async job without changing the domain — recorded as an assumption, doc 06.)
- **The preview read is a synchronous in-process port call** to IMP's content-query port; COMP renders
  against the returned read-only view and persists nothing from it.
- **PUB reads configuration synchronously in-process** through COMP's query ports at export time — an
  authoritative read, not an event subscription.
- **COMP's domain events (`MetadataUpdated` / `LayoutUpdated`) are dispatched in-process** (NestJS event
  emitter) after commit; they are best-effort notifications (e.g. preview/UI refresh), not a delivery
  guarantee and not a status driver.
- **Future async path (post-POC):** if a broker is enabled, cover processing and export could be
  event-driven; the port-based boundary makes this an adapter/orchestration change, not a domain change
  (assumption, doc 06).
