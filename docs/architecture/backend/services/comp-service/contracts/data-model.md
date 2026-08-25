# Data Model — comp-service (Composição)

**Module:** COMP · **Engine:** PostgreSQL 16 · **ORM:** Prisma (`prisma migrate`) · **Package base:** `@cordele`
**Governing ADRs:** shared `ADR-003-multi-tenancy.md` (schema-per-tenant), `ADR-002-modular-monolith.md`;
local `adr/ADR-002-layout-overrides-not-manuscript-mutation.md`, `adr/ADR-003-cover-binary-storage-port.md`.

The ` ```sql ` blocks below are the **canonical contract** consumed by `node-migration-generator.py`
(DDL → Prisma `schema.prisma` + initial migration) and `node-entity-generator.py`. Prose is for humans.

---

## 1. Conventions

- **PK strategy:** UUID v4, `id UUID NOT NULL DEFAULT gen_random_uuid()` (`gen_random_uuid()` is core in
  PostgreSQL 16 — no extension required).
- **Timestamps:** `TIMESTAMPTZ` in UTC; `atualizado_em` set on every write.
- **Soft-delete:** none. Rows are deleted for real (LGPD erasure via PROJ cascade, §5); values are mutable
  in place (idempotent upsert per `projeto_id`).
- **Encoding:** UTF-8; text columns are `TEXT`.
- **Naming:** snake_case tables/columns; Prisma models map back to PascalCase / camelCase.
- **Tenancy:** every COMP table lives in the **tenant schema** (`emp_<slug>`, e.g. `emp_aetos`); the Prisma
  adapter targets the schema resolved from `EmpresaContext` (RULE-07). No cross-tenant read is reachable.
- **Ownership:** COMP is the sole writer of `metadados`, `configuracao_layout` and `layout_override`
  (local ADR-002). It does **not** define `projeto_editorial` (PROJ), the manuscript/content tree (IMP,
  read-only via `ManuscriptContentPort`), `editora` (global registry) or `publicacao` (PUB). The cover
  binary is **not** a table — it lives in `FileStoragePort`, referenced by `metadados.capa_url` (ADR-003).
- **Two aggregates, lazy defaults (D-M).** `Metadados` and `ConfiguracaoLayout` are separate rows, each
  1:1 with a project (`UNIQUE(projeto_id)`), materialized lazily on first `PUT` (api-contract §0 D-M).

## 2. Entities

### 2.1 `metadados` [empresa]

Editorial identity of a project — one row per project (`UNIQUE(projeto_id)`). `titulo`, `autor` and
`idioma` are required; `isbn`, `categoria`, `editora_nome` are `source: mock` (BA — no external registry
in the POC). `capa_url` is an optional (D-L) reference to the cover binary in `FileStoragePort`; the bytes
are never stored here (ADR-003). The FK to `projeto_editorial` gives the DB-cascade backstop for LGPD
erasure (the orchestrated purge — PROJ D-G — is the actual mechanism; §5).

```sql
-- schema: empresa
CREATE TABLE metadados (
    id            UUID        NOT NULL DEFAULT gen_random_uuid(),
    projeto_id    UUID        NOT NULL,
    titulo        TEXT        NOT NULL,
    autor         TEXT        NOT NULL,
    isbn          TEXT,
    idioma        TEXT        NOT NULL DEFAULT 'pt',
    categoria     TEXT,
    capa_url      TEXT,
    editora_nome  TEXT,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    CONSTRAINT uq_metadados_projeto  UNIQUE (projeto_id),
    CONSTRAINT chk_metadados_titulo  CHECK (length(btrim(titulo)) > 0),
    CONSTRAINT chk_metadados_autor   CHECK (length(btrim(autor)) > 0),
    CONSTRAINT chk_metadados_idioma  CHECK (idioma IN ('pt', 'en', 'es', 'fr')),
    CONSTRAINT fk_metadados_projeto  FOREIGN KEY (projeto_id) REFERENCES projeto_editorial (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_metadados_projeto ON metadados (projeto_id);

COMMENT ON TABLE  metadados          IS 'Editorial identity of a project (COMP aggregate). One row per project; lazy-materialized (D-M). Never writes projeto_editorial or status.';
COMMENT ON COLUMN metadados.capa_url IS 'Reference to the cover binary in FileStoragePort (ADR-003); bytes never stored in the row. Optional (D-L).';
COMMENT ON COLUMN metadados.isbn     IS 'source: mock (BA) — no ISBN registry lookup in the POC.';
```

**Invariants:**

- `IF titulo or autor is blank, THEN THE SYSTEM SHALL reject the row (CHECK chk_metadados_titulo / chk_metadados_autor).`
- `IF idioma is not in {pt, en, es, fr}, THEN THE SYSTEM SHALL reject the row (CHECK chk_metadados_idioma).`
- `THE SYSTEM SHALL keep at most one metadados row per projeto_id (UNIQUE uq_metadados_projeto).`
- `THE SYSTEM SHALL store the cover binary only in FileStoragePort; capa_url holds a reference, never bytes.`
- `WHEN a projeto_editorial is deleted, THE SYSTEM SHALL cascade-delete its metadados row (FK ON DELETE CASCADE); the cover binary is purged by CompositionErasurePort (§5).`

### 2.2 `configuracao_layout` [empresa]

Presentation rules of a project — one row per project (`UNIQUE(projeto_id)`). Typography, line spacing,
side margin and heading sizes, all bounded (api-contract §7.2; the bounds live in the domain value objects
and are backed by CHECK constraints). Parent of `layout_override` (§2.3).

```sql
-- schema: empresa
CREATE TABLE configuracao_layout (
    id                  UUID        NOT NULL DEFAULT gen_random_uuid(),
    projeto_id          UUID        NOT NULL,
    fonte_corpo_familia TEXT        NOT NULL DEFAULT 'serif',
    fonte_corpo_tamanho INT         NOT NULL DEFAULT 12,
    espacamento_linha   NUMERIC(3,2) NOT NULL DEFAULT 1.5,
    margem_lateral      INT         NOT NULL DEFAULT 20,
    h1_tamanho          INT         NOT NULL DEFAULT 28,
    h2_tamanho          INT         NOT NULL DEFAULT 22,
    h3_tamanho          INT         NOT NULL DEFAULT 18,
    atualizado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    CONSTRAINT uq_cfglayout_projeto     UNIQUE (projeto_id),
    CONSTRAINT chk_cfglayout_familia    CHECK (fonte_corpo_familia IN ('serif', 'sans-serif')),
    CONSTRAINT chk_cfglayout_corpo      CHECK (fonte_corpo_tamanho BETWEEN 12 AND 20),
    CONSTRAINT chk_cfglayout_espacamento CHECK (espacamento_linha BETWEEN 1.2 AND 2.0),
    CONSTRAINT chk_cfglayout_margem     CHECK (margem_lateral BETWEEN 10 AND 40),
    CONSTRAINT chk_cfglayout_h1         CHECK (h1_tamanho BETWEEN 14 AND 48),
    CONSTRAINT chk_cfglayout_h2         CHECK (h2_tamanho BETWEEN 14 AND 48),
    CONSTRAINT chk_cfglayout_h3         CHECK (h3_tamanho BETWEEN 14 AND 48),
    CONSTRAINT chk_cfglayout_heading_order CHECK (h1_tamanho >= h2_tamanho AND h2_tamanho >= h3_tamanho),
    CONSTRAINT fk_cfglayout_projeto     FOREIGN KEY (projeto_id) REFERENCES projeto_editorial (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_cfglayout_projeto ON configuracao_layout (projeto_id);

COMMENT ON TABLE  configuracao_layout IS 'Presentation parameters of a project (COMP aggregate). One row per project; lazy-materialized (D-M). Only parameters PUB honours (api-contract §7.3).';
COMMENT ON COLUMN configuracao_layout.margem_lateral IS 'Side margin in mm; bounded 10..40.';
```

**Invariants:**

- `IF any typography value is outside its bound, THEN THE SYSTEM SHALL reject the row (CHECK chk_cfglayout_*).`
- `THE SYSTEM SHALL require h1_tamanho >= h2_tamanho >= h3_tamanho (CHECK chk_cfglayout_heading_order).`
- `THE SYSTEM SHALL keep at most one configuracao_layout row per projeto_id (UNIQUE uq_cfglayout_projeto).`
- `WHEN a projeto_editorial is deleted, THE SYSTEM SHALL cascade-delete its configuracao_layout row (FK ON DELETE CASCADE), which in turn cascades its layout_override rows (§2.3).`

### 2.3 `layout_override` [empresa]

Page-level presentation adjustments that **reference** manuscript nodes, never edit them (local ADR-002).
In the MVP the only writable `tipo` is `imagem` — a per-image alignment (D-H); `em-branco` (inserted blank
pages) is **reserved in the enum** but **rejected on write** in the POC (structural, deferred). Each
override names a manuscript node (`referencia_no`) validated against the current content tree on write via
`ManuscriptContentPort` (read-only, D-K); dangling references are rejected (`422`, invariant R2/G4).

```sql
-- schema: empresa
CREATE TABLE layout_override (
    id                     UUID        NOT NULL DEFAULT gen_random_uuid(),
    configuracao_layout_id UUID        NOT NULL,
    referencia_no          TEXT        NOT NULL,
    tipo                   TEXT        NOT NULL,
    alinhamento            TEXT,
    ordem                  INT         NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT chk_override_tipo        CHECK (tipo IN ('imagem', 'em-branco')),
    CONSTRAINT chk_override_alinhamento CHECK (alinhamento IS NULL OR alinhamento IN ('full', 'centralizado', 'junto-esquerda', 'junto-direita')),
    CONSTRAINT chk_override_imagem_alinhado CHECK (tipo <> 'imagem' OR alinhamento IS NOT NULL),
    CONSTRAINT chk_override_ordem       CHECK (ordem >= 0),
    CONSTRAINT fk_override_cfglayout    FOREIGN KEY (configuracao_layout_id) REFERENCES configuracao_layout (id) ON DELETE CASCADE
);

CREATE INDEX        idx_override_cfglayout ON layout_override (configuracao_layout_id, ordem);
CREATE UNIQUE INDEX uq_override_no         ON layout_override (configuracao_layout_id, referencia_no);

COMMENT ON TABLE  layout_override             IS 'Page/image presentation overrides referencing IMP content nodes (read reference, never a write — ADR-002). MVP writes tipo=imagem only; em-branco reserved/deferred (D-H).';
COMMENT ON COLUMN layout_override.referencia_no IS 'Read reference to a node in IMP''s content tree; validated via ManuscriptContentPort (read-only). Never a write to IMP.';
COMMENT ON COLUMN layout_override.tipo          IS 'imagem (per-image alignment, MVP) | em-branco (blank-page insert, reserved/deferred — rejected on write in POC).';
```

**Invariants:**

- `IF tipo is not in {imagem, em-branco}, THEN THE SYSTEM SHALL reject the row (CHECK chk_override_tipo).`
- `IF tipo=imagem AND alinhamento is null, THEN THE SYSTEM SHALL reject the row (CHECK chk_override_imagem_alinhado).`
- `IF tipo=em-branco is written in the POC, THEN THE SYSTEM SHALL reject it at the application layer (422 urn:cordele:comp:structural-edit-deferred, D-H).`
- `IF referencia_no does not resolve in the current manuscript content tree, THEN THE SYSTEM SHALL reject the write (422 urn:cordele:comp:override-ref-not-found).`
- `THE SYSTEM SHALL keep at most one override per (configuracao_layout_id, referencia_no) (UNIQUE uq_override_no).`
- `WHEN a configuracao_layout is deleted, THE SYSTEM SHALL cascade-delete its overrides (FK ON DELETE CASCADE).`

## 3. Cover binary is not a table (ADR-003)

The cover image is stored in `FileStoragePort` (local disk POC / S3-compatible prod) and referenced by
`metadados.capa_url`. COMP holds a reference, not the bytes (§2.1). Accepted formats (`image/jpeg`,
`image/png`, `image/webp`) and the 10 MB cap are enforced at the application layer (api-contract §4.3 / D-L),
not as DB constraints. Replaced covers leave orphaned objects for a cleanup routine (R5). The cover binary
participates in the LGPD erasure cascade via `CompositionErasurePort.purge` (§5), not via a DB FK.

## 4. Relations

```
emp_<slug>  (tenant schema)
+-------------------------+        +-------------------------------+
| projeto_editorial (PROJ)|  1     |  metadados (COMP)             |
| id (pk)                 |<---FK--|  projeto_id  UNIQUE           |
| status (PROJ only)      |  1     |  capa_url --> FileStoragePort |
+-------------------------+<---FK--+-------------------------------+
        ^  1                       +-------------------------------+
        |  (read-only ref)   1     |  configuracao_layout (COMP)   |
        |                    <--FK--|  projeto_id  UNIQUE           |
   manuscrito (IMP)                +---------------+---------------+
   content tree                                   | 1
   (ManuscriptContentPort,                        v *
    read-only, D-K)                    +-------------------------+
   layout_override.referencia_no ----> |  layout_override (COMP) |
   (read reference, never a write)     |  referencia_no (ref)    |
                                       +-------------------------+
```

`projeto_editorial` (PROJ) is referenced by FK (ON DELETE CASCADE backstop). The manuscript content tree
(IMP) is referenced **only logically** by `layout_override.referencia_no` — a read reference validated at
the application layer via `ManuscriptContentPort`, never a cross-table FK (IMP owns and never mutates it).

## 5. Data lifecycle & LGPD

- **Retention:** `metadados` and `configuracao_layout` are retained for the life of the title; updated in
  place (`atualizado_em`). No layout/version history in the POC (candidate later, doc 06).
- **Cover binary:** stored in `FileStoragePort`; replacing repoints `capa_url` and orphans the previous
  object for a cleanup routine (R5).
- **Deletion / erasure (PROJ D-G, gap G3):** COMP does **not** own the delete entry point (PROJ does). On
  the orchestrated cascade, PROJ calls `CompositionErasurePort.purge(projetoId)`, which idempotently
  deletes the `metadados`/`configuracao_layout` rows (overrides cascade via FK) **and** the cover binary
  in `FileStoragePort`. The DB `ON DELETE CASCADE` FK to `projeto_editorial` is the integrity backstop; the
  cover binary is not in the DB, so the port is what erases it.
- **Confidentiality (LGPD):** metadata (author name, cover image) and layout are unpublished creative
  assets; all access is tenant-scoped via `EmpresaContext`, never a caller-supplied id.

## 6. Migration plan

- Tooling: **`prisma migrate`** (`migrationsLocation = per-service`). DDL above → `schema.prisma` models +
  the initial migration.
- **Reserved range:** `V0001__create_metadados`, `V0002__create_configuracao_layout`,
  `V0003__create_layout_override`.
- **Schema-per-tenant application:** the DDL is replayed into every tenant schema (`emp_<slug>`) by the
  shared tenant-provisioning routine (runs on new-tenant bootstrap). Because COMP's FKs point at
  `projeto_editorial`, PROJ's table is provisioned first (shared platform concern, scaffold/infra, G8).
  Prisma's single-schema assumption is bridged by runtime schema targeting (RULE-07).

## 7. Schema-level mapping

| Table | Schema class | Owner | Notes |
|---|---|---|---|
| `metadados` | `emp_<slug>` (tenant) | **COMP** | this contract; 1:1 project; cover via FileStoragePort |
| `configuracao_layout` | `emp_<slug>` (tenant) | **COMP** | this contract; 1:1 project; bounded typography |
| `layout_override` | `emp_<slug>` (tenant) | **COMP** | this contract; image-alignment (MVP); em-branco deferred |
| `projeto_editorial` | `emp_<slug>` (tenant) | PROJ | referenced (FK backstop); not created here |
| `manuscrito` / content tree | `emp_<slug>` (tenant) | IMP | referenced logically by `referencia_no` (read-only); not here |
| cover binary | `FileStoragePort` (disk/S3) | COMP | not a DB table (ADR-003) |
