<!-- OUTPUT-SCHEMA
- System Boundary
- External Actors and Systems
- End-to-End Flows
- Internal Boundaries
- Cross-cutting Concerns
-->

# 02 — Architecture Blueprint

**Module:** PUB — Publicação · **Service:** `pub-service` · **Stack:** NestJS 11 + Prisma + PostgreSQL 16

## System Boundary

Publication is a single bounded-context module (`pub`) inside the Cordelê **modular monolith** (shared
`modular-monolith`). It owns the `Publicacao` aggregate and the ePub build/validate pipeline, and nothing
else. It does not own the manuscript, the metadata/layout, or the project lifecycle — it reads the first
three in-process and requests the fourth. Its public surface is a set of exported inbound ports:

- `GeneratePublicationUseCase.generate({ projetoId })` — enqueue an ePub build, return a `publicacaoId`.
- `GetPublicationStatusUseCase` — poll a `Publicacao` (status + epubcheck report when finished).
- `DownloadPublicationUseCase` — stream the stored `.epub` of a `publicado` publication.
- `ListPublicationsForProject` — the query port PROJ calls in-process for its history view.

The `pub-service` documentation directory is the home of this context; physically it is a NestJS module
within the single backend application.

## External Actors and Systems

- **Coordenador(a) Editorial** — triggers the build, polls status, downloads the file (via the Angular
  BFF / cordele-web).
- **epubcheck** — the W3C ePub validator (Java CLI/JAR), the one genuinely external system, reached
  through `EpubValidationPort`.
- **File storage** — local disk (POC) or S3-compatible (prod) behind `FileStoragePort`, holding the
  generated `.epub` binaries.
- **PostgreSQL 16** — via Prisma, for the `Publicacao` aggregate.
- **In-process peers** — IMP (`ManuscriptContentPort`), COMP (`GetMetadados` / `GetConfiguracaoLayout`),
  PROJ (`AdvanceProjetoStatusUseCase`); all synchronous in-process calls, no network, no broker.

## End-to-End Flows

**Golden path — generate a valid ePub (T07):**

1. Editor triggers "Gerar ePub" for a project → `GeneratePublicationUseCase.generate({ projetoId })`.
2. PUB creates a `Publicacao` in `gerando`, enqueues an in-process build job, and returns `publicacaoId`
   immediately (HTTP 202).
3. The job reads the manuscript content tree (IMP), metadata and layout (COMP) in-process; the
   `EpubBuilder` domain service assembles the OCF container (OPF manifest, spine, nav, XHTML chapters,
   images, stylesheet from the layout config).
4. Status moves to `validando`; `EpubValidationPort` runs epubcheck on the assembled package.
5. epubcheck reports **valid** → PUB stores the `.epub` via `FileStoragePort`, sets `Publicacao` to
   `publicado`, calls `PROJ.advanceTo(publicado)`, emits `PublicationSucceeded`.
6. Editor polls, sees `publicado`, and downloads via `DownloadPublicationUseCase`.

**Alternative — invalid ePub:**

- Step 5' epubcheck reports **errors** → PUB persists the report on the `Publicacao`, sets it to
  `com_erros`, calls `PROJ.advanceTo(com_erros)`, emits `PublicationFailed`. No downloadable file is
  offered; the editor reads the report and returns upstream to fix the cause.

**Alternative — build/assembly error:** an exception during assembly (e.g. missing required metadata,
storage unavailable) fails the job into `com_erros` with an error summary; PROJ is advanced to `com_erros`.
The trigger call itself never fails on build problems — it only fails fast on validation of the request
(unknown project, wrong tenant).

**History (T08):** PROJ calls `ListPublicationsForProject` in-process to render the history list; each row
links to a re-download of a `publicado` artifact.

## Internal Boundaries

Hexagonal layering (shared `hexagonal-node`):

- **Inbound adapter** — `PubController` (REST) + the exported use-case ports; maps HTTP to application
  calls, never touches Prisma or the filesystem.
- **Application** — `generate` / `get-status` / `download` / `list` services and the async build
  orchestration (job runner). Holds the transaction and the sequencing of read → assemble → validate →
  persist → advance-status → emit.
- **Domain** — `Publicacao` entity, `PublicationStatus` value object (the `gerando → validando →
  publicado | com_erros` transition table), the `EpubBuilder` domain service (pure assembly logic over an
  in-memory content model), and the outbound port interfaces. No `@nestjs/*`, no `@prisma/client`, no
  filesystem here.
- **Infrastructure (outbound)** — Prisma repository + mappers, `EpubValidationAdapter` (epubcheck),
  `FileStorageAdapter`, and the in-process read adapters over IMP/COMP and the status adapter over PROJ.

Dependency rule: `domain` imports nothing outward; `application` depends on `domain`; `infrastructure`
implements domain ports and is wired via `Symbol` injection tokens in `PubModule.providers`.

## Cross-cutting Concerns

- **Security / tenancy** — every operation runs inside an `EmpresaContext` (AsyncLocalStorage, RULE-07);
  the Prisma client and the artifact storage path are scoped to `emp_<slug>` so one tenant's builds and
  files are never visible to another (shared `multi-tenancy`).
- **Observability** — each build job carries a correlation id; status transitions and epubcheck outcomes
  are logged and reflected in the `Publicacao`; the job is observable by polling `GetPublicationStatus`.
- **Idempotency & concurrency** — a project has at most one in-flight build; re-triggering while one is
  `gerando`/`validando` returns the existing `publicacaoId` rather than starting a second (local ADR-002).
- **Resource safety** — epubcheck and assembly run with a timeout and bounded working directory; a
  crashed or timed-out job resolves the `Publicacao` to `com_erros` rather than leaving it stuck.
- **Artifact lifecycle** — `.epub` binaries live behind `FileStoragePort`, referenced by the
  `Publicacao`; the tables hold references, not bytes.
