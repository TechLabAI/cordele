<!-- OUTPUT-SCHEMA
- Schema Strategy
- Initial Entities
- Migration Strategy
- Data Lifecycle
-->

# 05 — Persistence Model

**Module:** COMP — Composição · **Engine:** PostgreSQL 16 · **ORM:** Prisma

## Schema Strategy

Cordelê uses **schema-per-tenant** multi-tenancy (shared `multi-tenancy`; `multiTenancy.isolationStrategy
= schema-per-tenant`). Two schema classes are relevant to Composition:

- **`cordele_global`** — shared registry not tenant-specific: `Editora` and platform users. Referenced
  by Composition (e.g. `editoraNome` display) but not written here.
- **`emp_<slug>` (e.g. `emp_aetos`)** — one schema per publishing house. `metadados` and
  `configuracao_layout` live here, alongside the other contexts' tenant data (`projeto_editorial`,
  manuscripts, publications).

Every Composition query runs inside `EmpresaContext` (AsyncLocalStorage, RULE-07), which the Prisma
adapter uses to target the correct tenant schema. Metadata/layout of another tenant's project is not
reachable; the tenant is never taken from a caller-supplied field.

> Note: the BA framing describes the POC as single-tenant (BA `ADR-005-poc-single-tenant`). The
> authoritative control-plane decision is schema-per-tenant multi-empresa; this document follows the
> control plane, with the single-tenant pilot as the one-schema special case. Reconciliation is tracked
> as an assumption in doc 06.

## Initial Entities

Owned by Composition (in the tenant schema):

**`Metadados`** — editorial identity of a project (one per project)

| Field | Type | Notes |
|---|---|---|
| `id` | string (pk) | |
| `projetoId` | ref → `ProjetoEditorial` | owning project (owned by PROJ); unique per project |
| `titulo` | string | **required** |
| `autor` | string | **required** |
| `isbn` | string, nullable | `source: mock` — no registry lookup in POC |
| `idioma` | enum `pt \| en \| es \| fr` | **required**, default `pt` |
| `categoria` | string, nullable | `source: mock` |
| `capaUrl` | string, nullable | reference to cover binary in `FileStoragePort` |
| `editoraNome` | string, nullable | `source: mock`, denormalized display |
| `atualizadoEm` | datetime | last change |

**`ConfiguracaoLayout`** — presentation rules of a project (one per project)

| Field | Type | Notes |
|---|---|---|
| `id` | string (pk) | |
| `projetoId` | ref → `ProjetoEditorial` | owning project; unique per project |
| `fonteCorpoFamilia` | enum `serif \| sans-serif` | body font |
| `fonteCorpoTamanho` | int | body font size (bounded) |
| `espacamentoLinha` | decimal | line spacing (bounded) |
| `margemLateral` | int | side margin (bounded) |
| `h1Tamanho` / `h2Tamanho` / `h3Tamanho` | int | heading sizes (bounded) |
| `atualizadoEm` | datetime | last change |

**`LayoutOverride`** (child of `ConfiguracaoLayout`) — page/image adjustments

| Field | Type | Notes |
|---|---|---|
| `id` | string (pk) | |
| `configuracaoLayoutId` | ref → `ConfiguracaoLayout` | parent |
| `referenciaNo` | string | manuscript node reference (IMP content tree) — **read reference, never a write** |
| `tipo` | enum `em-branco \| imagem` | inserted blank page or image placement |
| `alinhamento` | enum `full \| centralizado \| junto-esquerda \| junto-direita`, nullable | image alignment |
| `ordem` | int | position in the page sequence |

Referenced but **not owned** by Composition: `ProjetoEditorial` (PROJ), `Manuscrito` / content tree (IMP,
read-only), the cover binary (file storage), `Publicacao` (PUB), `Editora` (global registry). The
manuscript content is **not** copied into COMP; overrides hold references to it (local ADR-002).

Whether `Metadados` and `ConfiguracaoLayout` are one row each keyed by `projetoId` or fold into a single
`composicao` row is a Specs-phase modeling choice; the shape above follows the BA `data-model.json`
(two entities) and is the working assumption (doc 06).

## Migration Strategy

- Migrations via **`prisma migrate`** (`stack.migrationTool = prisma-migrate`), schema defined in
  `schema.prisma`. `migrationsLocation = per-service`: the `comp` context's model and migrations live
  with the service.
- Because tenant data is schema-per-tenant, the `metadados` / `configuracao_layout` / `layout_override`
  DDL is applied per tenant schema (`emp_<slug>`); the tenant-provisioning routine replays it into each
  new tenant schema. (Prisma's single-schema assumption is bridged by the runtime tenant-schema
  targeting; a shared platform concern for the scaffold/infra phase, common to all modules.)
- No Flyway, no Alembic — this is a Node/Prisma project.

## Data Lifecycle

- **Retention.** `Metadados` and `ConfiguracaoLayout` are mutable and retained for the life of the title;
  they are updated in place, with `atualizadoEm` capturing the last change. There is no layout/version
  history in the POC (candidate for a later revision, doc 06).
- **Cover binary.** Stored in `FileStoragePort`; replacing a cover repoints `capaUrl` and leaves the
  previous object orphaned — a cleanup routine (or storage lifecycle policy) removes superseded covers
  (gap, doc 06).
- **Confidentiality (framing §2.7, LGPD).** Metadata (author name, cover image) and layout are
  unpublished creative assets; all access is tenant-scoped.
- **Deletion & LGPD erasure.** When PROJ deletes a `ProjetoEditorial`, Composition must delete the
  project's `Metadados`, `ConfiguracaoLayout`, its overrides, and the cover binary in storage. COMP does
  not own the delete entry point (PROJ does); it participates in the cross-context cascade (doc 06).
- **Archival.** Not in POC scope.
