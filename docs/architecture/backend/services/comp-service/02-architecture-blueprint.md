<!-- OUTPUT-SCHEMA
- System Boundary
- External Actors and Systems
- End-to-End Flows
- Internal Boundaries
- Cross-cutting Concerns
-->

# 02 — Architecture Blueprint

**Module:** COMP — Composição · **Service:** `comp-service` · **Stack:** NestJS 11 + Prisma + PostgreSQL 16

## System Boundary

Composition is a bounded-context NestJS module (`comp`) inside the Cordelê modular monolith (shared
`modular-monolith`). It is responsible for everything about a project's *presentation configuration*:
the editorial metadata that identifies the book and the layout that decides how it reads.

Inside the boundary:
- Creating and updating a project's `Metadados` (title, author, ISBN, language, category, cover
  reference) with validation.
- Creating and updating a project's `ConfiguracaoLayout` (typography, margins, heading sizes) and its
  page-level layout overrides (inserted blank pages, per-image alignment).
- Storing the cover binary through a storage port and holding its reference.
- Assembling the layout **preview** by reading IMP's manuscript content tree (read-only).
- Serving `Metadados` and `ConfiguracaoLayout` to Publication at export time.

Outside the boundary (referenced or read, never owned here):
- `ProjetoEditorial` and its `status` — owned by Projects (PROJ).
- `Manuscrito` and its content tree — owned by Import (IMP); read, never written.
- Cover image bytes — held in file storage behind a port, not in COMP's tables.
- `Publicacao` and ePub artifacts — owned by Publication (PUB).
- `Editora` (tenant registry) — lives in `cordele_global`.

## External Actors and Systems

- **Coordenador(a) Editorial** — configures metadata and layout through the Angular frontend (T05, T06).
- **Cordelê BFF (NestJS)** — the single entry point (TECH-003); Composition is reached only through it.
- **Import (IMP)** — *in-process* source of the manuscript content tree; COMP reads it through a
  read-only `ManuscriptContentPort` to render the preview. COMP never writes IMP data.
- **Publication (PUB)** — *in-process* consumer: calls COMP's `GetMetadados` / `GetConfiguracaoLayout`
  query ports at export to assemble the ePub.
- **Projects (PROJ)** — referenced only for identity: COMP configuration is keyed to a `projetoId` that
  PROJ owns. COMP does **not** call PROJ's `advanceTo` and never writes `projeto_editorial`.
- **File storage** — local disk (POC) / S3-compatible (prod) behind `FileStoragePort`; holds the cover
  image referenced by `capaUrl`.
- **PostgreSQL 16** — persists `Metadados` and `ConfiguracaoLayout` in the tenant schema.
- **No message broker** — `stack.messaging.enabled = false`. Cross-context reads are synchronous
  in-process port calls; COMP's own domain events are in-process only.
- **No external APIs and no AI provider** — `isbn`/`categoria`/`editoraNome` are `source: mock`.

## End-to-End Flows

**Golden path — configure a book's composition**

1. A manuscript has been imported and PROJ is in `em_composicao`. Within the active `EmpresaContext`, the
   editor opens metadata (T05). COMP creates or loads the project's `Metadados` (a default draft on first
   access), the editor fills `titulo`*, `autor`*, `idioma`*, and optionally `isbn`/`categoria`.
2. The editor uploads a cover. COMP stores the binary through `FileStoragePort`, keeps the returned
   reference as `capaUrl`, persists `Metadados`, and emits `MetadataUpdated`.
3. The editor opens the layout editor (T06). COMP loads (or defaults) the `ConfiguracaoLayout` and reads
   the manuscript content tree via `ManuscriptContentPort` to render the preview.
4. The editor adjusts typography/margins/heading sizes and makes page-level adjustments — inserts a blank
   page, sets an image's alignment. COMP records these as **overrides** referencing manuscript nodes,
   persists `ConfiguracaoLayout`, and emits `LayoutUpdated`. The manuscript is untouched.
5. The editor proceeds to export (PUB). Publication calls `GetMetadados` / `GetConfiguracaoLayout` for the
   `projetoId` and assembles the ePub from exactly this configuration.

**Alternative — incomplete metadata:** required fields (`titulo`, `autor`, `idioma`) missing → COMP
rejects the save/finalize with typed validation errors; nothing invalid is stored, and PUB has nothing
incomplete to read.

**Alternative — re-composition after an error:** a project in `com_erros` re-enters composition; the
editor changes metadata/layout, COMP persists the new configuration and emits the update. COMP does not
change status; PUB/PROJ handle the lifecycle when the editor re-exports.

**Alternative — cover replaced:** uploading a new cover stores a new binary and repoints `capaUrl`; the
previous object becomes eligible for cleanup (data-lifecycle, doc 05/06).

## Internal Boundaries

Hexagonal layering per the shared `hexagonal-node` ADR, directories as layers, the `comp` module as the
bounded context:

- **domain/** — the `Metadados` and `ConfiguracaoLayout` aggregates, value objects (`Idioma`, font
  family/size, `Alinhamento` for image placement, the layout-override model), and ports: inbound
  `UpdateMetadadosUseCase`, `UpdateLayoutUseCase`, `GetMetadadosUseCase`, `GetConfiguracaoLayoutUseCase`,
  `GetLayoutPreviewUseCase`; outbound `MetadadosRepositoryPort`, `ConfiguracaoLayoutRepositoryPort`,
  `FileStoragePort`, `ManuscriptContentPort` (read-only view of IMP). No `@nestjs/*`, no `@prisma/client`
  here.
- **modules/comp/** (application) — `CompModule`, the controller, and the use-case services that
  orchestrate metadata update, cover upload, layout update, preview assembly and the read paths. The
  transaction boundary and event emission live here.
- **infrastructure/** — Prisma repository adapters + mappers for `Metadados`/`ConfiguracaoLayout`; the
  `FileStoragePort` adapter (disk/S3); and the `ManuscriptContentPort` adapter over IMP's in-process
  content-query port. Bound to domain ports via `Symbol` DI tokens in the module's `providers`.

The dependency rule points inward: persistence, storage and the IMP read adapter depend on domain
contracts, never the reverse. `GetMetadadosUseCase` / `GetConfiguracaoLayoutUseCase` are exported so PUB
depends only on those ports (shared `hexagonal-node` §5), not on COMP internals.

## Cross-cutting Concerns

- **Multi-tenancy (shared `multi-tenancy`).** `EmpresaContext` (AsyncLocalStorage, RULE-07) carries the
  tenant; the Prisma adapter targets `emp_<slug>`. Metadata/layout of another tenant's project is not
  reachable; the tenant is never taken from a caller-supplied field.
- **Manuscript immutability (local ADR-002).** The `ManuscriptContentPort` is read-only; layout choices
  are overrides referencing manuscript nodes, so composition never diffs the content tree.
- **Validation & error handling.** Typed domain errors for missing required metadata (`titulo`, `autor`,
  `idioma`) and for layout values outside allowed ranges, raised before any persistence side effect.
- **Confidentiality & LGPD (`compliance.lgpd = true`).** Metadata (author name, cover) and layout are
  unpublished creative assets; all access is tenant-scoped, and the cover binary participates in the
  project's cross-context erasure cascade (doc 06).
- **Observability.** Structured logs and pipeline events for each metadata/layout save and cover upload,
  correlated by `trace_id`.
