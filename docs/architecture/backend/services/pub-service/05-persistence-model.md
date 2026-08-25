<!-- OUTPUT-SCHEMA
- Schema Strategy
- Initial Entities
- Migration Strategy
- Data Lifecycle
-->

# 05 — Persistence Model

**Module:** PUB — Publicação · **Engine:** PostgreSQL 16 · **ORM:** Prisma

## Schema Strategy

Cordelê uses **schema-per-tenant** multi-tenancy (shared `multi-tenancy`): a `cordele_global` schema for
cross-tenant registries and one `emp_<slug>` schema per editora. Publication's tables live in the
**per-tenant** schema — a `Publicacao` belongs to exactly one editora and is never visible across
tenants. The active schema is selected from the `EmpresaContext` (AsyncLocalStorage, RULE-07) that wraps
every request and every build job; the Prisma client and the `FileStoragePort` path prefix are both bound
to `emp_<slug>`. The BA POC single-tenant setup is the one-tenant special case of the same model.

Publication owns **no** global-schema tables. `ProjetoEditorial`, `Manuscrito`, `Metadados`,
`ConfiguracaoLayout` and `Editora` are referenced by id and read from their owners in-process — never
copied into PUB's schema.

## Initial Entities

Draft Prisma model (per-tenant schema). Names are indicative; the authoritative `schema.prisma` is
produced in Specs/Scaffold.

- **`publicacao`**
  - `id` (uuid, pk)
  - `projeto_id` (uuid) — references PROJ's `ProjetoEditorial`; **not** a cross-schema FK, an application
    reference validated through PROJ's read port
  - `status` (enum: `gerando | validando | publicado | com_erros`)
  - `sequencia` (int) — per-project monotonic attempt number
  - `artefato_ref` (text, nullable) — `FileStoragePort` reference to the `.epub`; non-null only when
    `publicado`
  - `resumo_erro` (text, nullable) — short failure summary when `com_erros`
  - `iniciada_em` (timestamptz), `concluida_em` (timestamptz, nullable)
  - indexes: `(projeto_id, sequencia)` unique; `(projeto_id, status)` for "in-flight per project" and
    history queries

- **`validation_message`** — the epubcheck report, one row per message (or a single `jsonb` column on
  `publicacao`; the row-per-message form is preferred for queryable reports)
  - `id` (uuid, pk), `publicacao_id` (uuid, fk → `publicacao`)
  - `severity` (enum: `error | warning | info`), `code` (text), `message` (text), `location` (text,
    nullable)
  - index: `(publicacao_id, severity)`

Enums: `publicacao_status`, `validation_severity`.

## Migration Strategy

- Migrations via **Prisma Migrate** (`prisma migrate`), the project standard (`migrationTool =
  prisma-migrate`, `migrationsLocation = per-service`). Publication owns the migrations for its own
  tables under `pub-service`.
- Each migration is applied to **every** `emp_<slug>` schema plus the template used to provision new
  tenants; `cordele_global` receives none of PUB's tables (Publication has no global tables).
- No cross-schema foreign keys to PROJ/IMP/COMP: those relationships are application-level references
  resolved through in-process ports, keeping each context's schema independently migratable.

## Data Lifecycle

- **Publications are append-only history.** A terminal `Publicacao` (`publicado`/`com_erros`) is never
  overwritten; re-generating a project creates a new `Publicacao` with the next `sequencia`. This backs
  PROJ's history view (T08) and the "re-download a prior build" flow.
- **Artifacts** (`.epub`) live behind `FileStoragePort`, keyed by tenant + `publicacaoId`; the DB holds
  the reference. Retention of superseded artifacts is a policy decision deferred to post-POC (doc 06,
  assumption A3) — the POC keeps every successful artifact.
- **Validation reports** are retained with their publication for auditability of why a build was rejected.
- **Retention / archival** windows and pruning of old `com_erros` attempts are out of MVP scope and left
  as an operational policy to define later; nothing is auto-deleted in the POC.
