<!-- OUTPUT-SCHEMA
- Schema Strategy
- Initial Entities
- Migration Strategy
- Data Lifecycle
-->

# 05 — Persistence Model

**Module:** PROJ — Projetos · **Engine:** PostgreSQL 16 · **ORM:** Prisma

## Schema Strategy

Cordelê uses **schema-per-tenant** multi-tenancy (shared `multi-tenancy`; `multiTenancy.isolationStrategy
= schema-per-tenant`). Two schema classes are relevant to Projects:

- **`cordele_global`** — shared registry that is not tenant-specific: `Editora` (the tenant/publisher
  account) and platform users. Read by Projects to resolve the owning tenant; not written here.
- **`emp_<slug>` (e.g. `emp_aetos`)** — one schema per publishing house. The `projeto_editorial` table
  lives here, alongside the other contexts' tenant data (manuscripts, metadata, layout, publications).

Every Projects query runs inside `EmpresaContext` (AsyncLocalStorage, RULE-07), which the Prisma adapter
uses to target the correct tenant schema. A project of another tenant is not reachable; the tenant is
never taken from a caller-supplied field, including on `advanceTo`.

> Note: the BA framing describes the POC as single-tenant (BA `ADR-005-poc-single-tenant`), modelling
> `Editora` as a "simplified tenant". The authoritative control-plane decision is schema-per-tenant
> multi-empresa; this document follows the control plane, with the single-tenant pilot as the one-schema
> special case. Reconciliation is tracked as an assumption in doc 06.

## Initial Entities

Owned by Projects (in the tenant schema):

**`ProjetoEditorial`** — the editorial project (aggregate root)

| Field | Type | Notes |
|---|---|---|
| `id` | string (pk) | |
| `editoraId` | ref → `Editora` | owning tenant (registry in `cordele_global`) |
| `nome` | string | project / title name |
| `status` | enum `rascunho \| em_composicao \| publicado \| com_erros` | authoritative lifecycle status; PROJ is the only writer |
| `descricao` | string, nullable | optional short description (POC) |
| `criadoEm` | datetime | creation timestamp |
| `atualizadoEm` | datetime | last status/attribute change |

Referenced but **not owned** by Projects: `Manuscrito` (IMP), `Metadados` / `ConfiguracaoLayout` (COMP),
`Publicacao` (PUB), `Editora` (global registry). Their foreign keys point *to* `projeto_editorial`
(`projetoId`), owned by their own contexts; Projects does not hold references back to them as columns.

**Publication history is not a table** (ADR-003). It is assembled at read time from PUB's `Publicacao`
records for the project, via `PublicationHistoryPort`. Projects stores no duplicated publication rows,
avoiding drift between the history view and Publication's source of truth.

An optional **status-change log** (project-scoped audit of `from`/`to`/`requestedBy`/`changedAt`) is a
candidate for the Specs phase if auditability is required beyond `atualizadoEm`; noted in doc 06.

## Migration Strategy

- Migrations via **`prisma migrate`** (`stack.migrationTool = prisma-migrate`), schema defined in
  `schema.prisma`. `migrationsLocation = per-service`: the `proj` context's model and migrations live
  with the service.
- Because tenant data is schema-per-tenant, the `projeto_editorial` DDL is applied per tenant schema
  (`emp_<slug>`); the tenant-provisioning routine replays it into each new tenant schema. (Prisma's
  single-schema assumption is bridged by the runtime tenant-schema targeting; this is a shared platform
  concern for the scaffold/infra phase, common to all modules.)
- No Flyway, no Alembic — this is a Node/Prisma project.

## Data Lifecycle

- **Retention.** A `ProjetoEditorial` is retained for the life of the title; status is updated in place
  (it is mutable, unlike the immutable `Manuscrito`), while `criadoEm`/`atualizadoEm` capture its
  timeline.
- **Confidentiality (framing §2.7, LGPD).** A project groups sensitive unpublished creative work; all
  access is tenant-scoped.
- **Deletion & LGPD erasure.** Because a project is the identity every other context binds to, deleting a
  `ProjetoEditorial` must **cascade** to its manuscripts and stored binaries (IMP), metadata/layout
  (COMP) and publications/artifacts (PUB). PROJ owns the delete entry point but the cascade spans
  contexts — the exact mechanism (in-process orchestrated deletion vs. per-context cleanup) is a
  cross-context concern to specify with IMP/COMP/PUB (doc 06).
- **Archival.** Not in POC scope; a "closed/archived" project state could be added post-POC without
  changing the core model.
