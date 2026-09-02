# Data Model — pub-service (Publicação)

**Module:** PUB · **Engine:** PostgreSQL 16 · **ORM:** Prisma (`prisma migrate`) · **Package base:** `@cordele`
**Governing ADRs:** shared `ADR-003-multi-tenancy.md` (schema-per-tenant), `ADR-002-modular-monolith.md`;
local `adr/ADR-002-async-build-status-machine.md`, `adr/ADR-003-epubcheck-validation-port.md`.

The ` ```sql ` blocks below are the **canonical contract** consumed by `node-migration-generator.py`
(DDL → Prisma `schema.prisma` + initial migration) and `node-entity-generator.py`. Prose is for humans.

---

## 1. Conventions

- **PK strategy:** UUID v4, `id UUID NOT NULL DEFAULT gen_random_uuid()` (`gen_random_uuid()` is core in
  PostgreSQL 16 — no extension required).
- **Timestamps:** `TIMESTAMPTZ` in UTC; build start is `iniciada_em DEFAULT now()`; `concluida_em` is set
  when the build reaches a terminal state.
- **Append-only history:** a terminal `publicacao` (`publicado`/`com_erros`) is never overwritten;
  re-generating a project inserts a new row with the next `sequencia` (doc 05). No soft-delete.
- **Encoding:** UTF-8; text columns are `TEXT`.
- **Naming:** snake_case tables/columns; Prisma models map back to PascalCase / camelCase.
- **Tenancy:** every PUB table lives in the **tenant schema** (`emp_<slug>`, e.g. `emp_aetos`); none in
  `cordele_global`. The Prisma adapter targets the schema resolved from `EmpresaContext` (RULE-07). The
  `.epub` binary and the epubcheck report bytes are **not** in the DB — the artifact lives behind
  `FileStoragePort` (ADR-003); the row holds a reference.

## 2. Entities

### 2.1 `publicacao` [empresa]

The aggregate root owned by Publication — one row per export attempt. It carries **two** status fields
(local ADR-002/ADR-003, api-contract §0 D-Q): `status` is the async **build-machine** state
(`gerando → validando → publicado | com_erros`), and `epubcheck_status` is the **epubcheck verdict**
(`valido | avisos | erros_criticos | pendente`) surfaced to PROJ/FE. Warnings do not block publication
(`avisos → status=publicado`). `projeto_id` references PROJ's `projeto_editorial` (owned by PROJ; PUB
never writes it); the FK is the LGPD integrity backstop (§5), not the erasure mechanism. `artefato_ref`
is the `FileStoragePort` key of the `.epub`, non-null only when `publicado`. `sequencia` is the
per-project monotonic attempt number backing history (T08). The partial unique index
`uq_publicacao_projeto_inflight` enforces **at most one non-terminal build per project** (D-R).

```sql
-- schema: empresa
CREATE TABLE publicacao (
    id               UUID        NOT NULL DEFAULT gen_random_uuid(),
    projeto_id       UUID        NOT NULL,
    status           TEXT        NOT NULL DEFAULT 'gerando',
    epubcheck_status TEXT        NOT NULL DEFAULT 'pendente',
    sequencia        INTEGER     NOT NULL,
    artefato_ref     TEXT,
    resumo_erro      TEXT,
    total_erros      INTEGER     NOT NULL DEFAULT 0,
    total_avisos     INTEGER     NOT NULL DEFAULT 0,
    tamanho_bytes    BIGINT,
    total_capitulos  INTEGER,
    total_imagens    INTEGER,
    iniciada_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
    concluida_em     TIMESTAMPTZ,
    PRIMARY KEY (id),
    CONSTRAINT chk_publicacao_status    CHECK (status IN ('gerando', 'validando', 'publicado', 'com_erros')),
    CONSTRAINT chk_publicacao_epubcheck CHECK (epubcheck_status IN ('valido', 'avisos', 'erros_criticos', 'pendente')),
    CONSTRAINT chk_publicacao_sequencia CHECK (sequencia >= 1),
    CONSTRAINT chk_publicacao_counts    CHECK (total_erros >= 0 AND total_avisos >= 0),
    CONSTRAINT chk_publicacao_artefato  CHECK ((status = 'publicado') = (artefato_ref IS NOT NULL)),
    CONSTRAINT chk_publicacao_summary   CHECK ((status = 'publicado') = (tamanho_bytes IS NOT NULL AND total_capitulos IS NOT NULL AND total_imagens IS NOT NULL)),
    CONSTRAINT chk_publicacao_summary_nonneg CHECK (tamanho_bytes IS NULL OR (tamanho_bytes >= 0 AND total_capitulos >= 0 AND total_imagens >= 0)),
    CONSTRAINT uq_publicacao_projeto_seq UNIQUE (projeto_id, sequencia),
    CONSTRAINT fk_publicacao_projeto    FOREIGN KEY (projeto_id) REFERENCES projeto_editorial (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX uq_publicacao_projeto_inflight ON publicacao (projeto_id) WHERE status IN ('gerando', 'validando');
CREATE INDEX idx_publicacao_projeto_status ON publicacao (projeto_id, status);
CREATE INDEX idx_publicacao_projeto_iniciada ON publicacao (projeto_id, iniciada_em DESC);

COMMENT ON TABLE  publicacao                  IS 'ePub export attempt (aggregate root, PUB context). Append-only history; terminal rows are never mutated.';
COMMENT ON COLUMN publicacao.status           IS 'Async build-machine state: gerando -> validando -> publicado | com_erros (ADR-002).';
COMMENT ON COLUMN publicacao.epubcheck_status IS 'epubcheck verdict: valido | avisos | erros_criticos | pendente (ADR-003 / D-Q). avisos still publishes.';
COMMENT ON COLUMN publicacao.artefato_ref     IS 'FileStoragePort key of the .epub; non-null iff status=publicado (chk_publicacao_artefato).';
COMMENT ON COLUMN publicacao.sequencia        IS 'Per-project monotonic attempt number (history / T08).';
COMMENT ON COLUMN publicacao.resumo_erro      IS 'Short human-readable failure summary; set when com_erros.';
COMMENT ON COLUMN publicacao.tamanho_bytes    IS 'Byte size of the assembled .epub, measured at write time; non-null iff status=publicado (ADR-004).';
COMMENT ON COLUMN publicacao.total_capitulos  IS 'Chapter count from the ManuscriptContentPort walk at this build; historical snapshot, not a live mirror of imp-service (ADR-004).';
COMMENT ON COLUMN publicacao.total_imagens    IS 'Image-block count from the ManuscriptContentPort walk at this build; historical snapshot, not a live mirror of imp-service (ADR-004).';
```

**Invariants:**

- `IF status is not in {gerando, validando, publicado, com_erros}, THEN THE SYSTEM SHALL reject the row
  (CHECK chk_publicacao_status).`
- `THE SYSTEM SHALL hold at most one publicacao per project in gerando or validando`
  (partial UNIQUE `uq_publicacao_projeto_inflight` — D-R).
- `THE SYSTEM SHALL set artefato_ref non-null exactly when status is publicado`
  (CHECK chk_publicacao_artefato — a published attempt always has an artifact; a non-published one never
  does).
- `THE SYSTEM SHALL set tamanho_bytes, total_capitulos and total_imagens non-null exactly when status is
  publicado, as a build-time snapshot taken from the same ManuscriptContentPort walk and the same artifact
  write that populate artefato_ref` (CHECK chk_publicacao_summary — ADR-004; these are historical, not a
  live mirror of imp-service's own manuscrito counts).
- `THE SYSTEM SHALL assign a contiguous, unique sequencia per project` (UNIQUE `uq_publicacao_projeto_seq`;
  next value computed application-side within the tenant).
- `WHEN a ProjetoEditorial is deleted, THE SYSTEM SHALL cascade-delete its publicacoes` (FK ON DELETE
  CASCADE; artifact erasure handled by `PublicationErasurePort`, §5).
- `THE SYSTEM SHALL never update a terminal publicacao row` (append-only; only the in-flight row
  transitions gerando → validando → terminal).

### 2.2 `validation_message` [empresa]

One row per epubcheck message (the report is persisted for auditability of *why* a build was rejected or
warned — doc 05). `severity` follows epubcheck's classes; the aggregate counts on `publicacao`
(`total_erros`/`total_avisos`) are derived from these rows at persist time.

```sql
-- schema: empresa
CREATE TABLE validation_message (
    id            UUID        NOT NULL DEFAULT gen_random_uuid(),
    publicacao_id UUID        NOT NULL,
    severity      TEXT        NOT NULL,
    code          TEXT        NOT NULL,
    message       TEXT        NOT NULL,
    location      TEXT,
    ordem         INTEGER     NOT NULL DEFAULT 0,
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    CONSTRAINT chk_validation_message_severity CHECK (severity IN ('error', 'warning', 'info')),
    CONSTRAINT fk_validation_message_pub FOREIGN KEY (publicacao_id) REFERENCES publicacao (id) ON DELETE CASCADE
);

CREATE INDEX idx_validation_message_pub_sev ON validation_message (publicacao_id, severity);

COMMENT ON TABLE  validation_message          IS 'epubcheck report, one row per message. Retained with the publicacao for auditability (ADR-003).';
COMMENT ON COLUMN validation_message.severity IS 'error | warning | info (epubcheck message class). error rows drive erros_criticos.';
COMMENT ON COLUMN validation_message.code     IS 'epubcheck message code (e.g. RSC-005, OPF-014).';
COMMENT ON COLUMN validation_message.location IS 'File/line location within the OCF package (nullable).';
```

**Invariants:**

- `IF severity is not in {error, warning, info}, THEN THE SYSTEM SHALL reject the row
  (CHECK chk_validation_message_severity).`
- `THE SYSTEM SHALL keep publicacao.total_erros / total_avisos equal to the count of validation_message
  rows of severity error / warning for that publicacao` (application-enforced at persist).
- `WHEN a publicacao is deleted, THE SYSTEM SHALL cascade-delete its validation_message rows` (FK ON DELETE
  CASCADE).

## 3. Enums

Modelled as `TEXT` + `CHECK` (Prisma maps to enums in `schema.prisma`); the generator emits Prisma enums.

| Enum | Values | Column |
|---|---|---|
| `publicacao_status` | `gerando`, `validando`, `publicado`, `com_erros` | `publicacao.status` |
| `epubcheck_status` | `valido`, `avisos`, `erros_criticos`, `pendente` | `publicacao.epubcheck_status` |
| `validation_severity` | `error`, `warning`, `info` | `validation_message.severity` |

## 4. Relations

```
emp_<slug>  (tenant schema)
+--------------------------+
|  projeto_editorial (PROJ)|
|  id (pk)                 |
+------------+-------------+
             | 1
             | owns / cascades (FK, integrity backstop)
             v *
+--------------------------+        1        +---------------------------+
|  publicacao  (PUB-owned) |---- owns ---->  |  validation_message (PUB) |
|  projeto_id  ── FK ──────>|        *        |  publicacao_id ── FK ────>|
+--------------------------+                 +---------------------------+
             |
             | artefato_ref (not a DB row)
             v
      FileStoragePort  (.epub binary — disk POC / S3 prod)
```

`projeto_editorial` is owned by PROJ; shown for context only — PUB does not create it. The `.epub` artifact
is not a DB entity; the row references it by key.

## 5. Data lifecycle & LGPD

- **Retention:** every `publicado` artifact is kept in the POC (doc 05, assumption A3); superseded-artifact
  pruning is a post-POC operational policy. Validation reports are retained with their `publicacao`.
- **Deletion / erasure:** the `ON DELETE CASCADE` FK removes `publicacao` (and its `validation_message`
  rows) when the owning `projeto_editorial` is deleted. Stored `.epub` binaries are **not** in the DB; the
  `PublicationErasurePort.purge(projetoId)` application path (LGPD cascade step 1, proj integration-contracts
  §3 / G3) must also delete the tenant-scoped artifacts via `FileStoragePort`. `purge` is idempotent.
- **Confidentiality:** artifacts are unpublished creative work; stored under tenant-scoped keys, never
  exposed except through a short-TTL signed URL (api-contract §4.4).

## 6. Migration plan

- Tooling: **`prisma migrate`** (`migrationsLocation = per-service`). DDL above → `schema.prisma` models +
  the initial migration.
- **Reserved range:** `V0001__create_publicacao_validation_message` (initial: both tables + enums +
  indexes). Subsequent PUB migrations continue `V0002__...` (e.g. an artifact-retention/pruning table if
  A3 is revisited).
- **Schema-per-tenant application:** the DDL is replayed into **every** tenant schema (`emp_<slug>`) by the
  shared tenant-provisioning routine, in addition to bootstrapping a new tenant. `cordele_global` receives
  none of PUB's tables. Prisma's single-schema assumption is bridged by runtime schema targeting (RULE-07)
  and the provisioning routine (shared platform concern — flagged for scaffold/infra, doc 06).
- **No cross-schema FKs** to IMP/COMP: those relationships are application-level references resolved through
  in-process ports, keeping each context independently migratable. The one FK (`projeto_id →
  projeto_editorial`) is intra-schema (both live in `emp_<slug>`).

## 7. Schema-level mapping

| Table | Schema class | Owner | Notes |
|---|---|---|---|
| `publicacao` | `emp_<slug>` (tenant) | **PUB** | this contract |
| `validation_message` | `emp_<slug>` (tenant) | **PUB** | this contract (child of `publicacao`) |
| `projeto_editorial` | `emp_<slug>` (tenant) | PROJ | referenced (FK); not created here |
