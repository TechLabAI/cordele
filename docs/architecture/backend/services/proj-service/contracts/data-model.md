# Data Model — proj-service (Projetos)

**Module:** PROJ · **Engine:** PostgreSQL 16 · **ORM:** Prisma (`prisma migrate`) · **Package base:** `@cordele`
**Governing ADRs:** shared `ADR-003-multi-tenancy.md` (schema-per-tenant), `ADR-002-modular-monolith.md`;
local `adr/ADR-002-project-status-authority.md`, `adr/ADR-003-publication-history-read-model.md`.

The ` ```sql ` blocks below are the **canonical contract** consumed by `node-migration-generator.py`
(DDL → Prisma `schema.prisma` + initial migration) and `node-entity-generator.py`. Prose is for humans.

---

## 1. Conventions

- **PK strategy:** UUID v4, `id UUID NOT NULL DEFAULT gen_random_uuid()` (`gen_random_uuid()` is core in
  PostgreSQL 16 — no extension required).
- **Timestamps:** `TIMESTAMPTZ` in UTC; `criado_em DEFAULT now()`; `atualizado_em` set on every write.
- **Soft-delete:** none. A project is deleted for real (LGPD erasure, §5); status is mutable in place.
- **Encoding:** UTF-8; text columns are `TEXT`.
- **Naming:** snake_case tables/columns; Prisma models map back to PascalCase / camelCase.
- **Tenancy:** every PROJ table lives in the **tenant schema** (`emp_<slug>`, e.g. `emp_aetos`); the
  `editora` registry it references lives in `cordele_global` and is **not** created here. The Prisma
  adapter targets the schema resolved from `EmpresaContext` (RULE-07).
- **Ownership:** PROJ is the **sole writer** of `projeto_editorial` (ADR-002). No `Publicacao`,
  `Manuscrito`, `Metadados` or `ConfiguracaoLayout` table is defined here — those belong to PUB/IMP/COMP;
  publication history is a read-side view over PUB (ADR-003), never a PROJ table.

## 2. Entities

### 2.1 `projeto_editorial` [empresa]

The editorial project — the aggregate root owned by Projects and the identity every other context binds
to. `status` is authoritative and only PROJ writes it (ADR-002); the legal-transition rules live in the
`ProjectStatus` value object, not in a DB trigger. `editora_id` references the global `editora` registry;
because `editora` is in `cordele_global` and this table is in the tenant schema, the reference is a
**logical** one validated in the application layer, not a cross-schema FK — and, since that registry does
not exist yet, the column is a plain `VARCHAR` rather than a DB-enforced `UUID` (tracked as a pendência;
until the registry lands, callers populate it with the same value as `empresaId`). `empresaId` itself is
never persisted as a column — it is the tenant-routing key that selects the `emp_<slug>` schema (RULE-07)
and is passed alongside `editora_id` on every write. This table is the **cascade
root** for LGPD erasure: the other contexts' tables (`manuscrito`, `metadados`, `configuracao_layout`,
`publicacao`) declare `FOREIGN KEY (projeto_id) REFERENCES projeto_editorial (id) ON DELETE CASCADE` in
their own contexts, so DB-level integrity is a backstop to the orchestrated purge (§5, SPEC-11).

```sql
-- schema: empresa
CREATE TABLE projeto_editorial (
    id            UUID        NOT NULL DEFAULT gen_random_uuid(),
    editora_id    VARCHAR(64) NOT NULL,
    nome          TEXT        NOT NULL,
    status        TEXT        NOT NULL DEFAULT 'rascunho',
    descricao     TEXT,
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    CONSTRAINT chk_projeto_status CHECK (status IN ('rascunho', 'em_composicao', 'publicado', 'com_erros')),
    CONSTRAINT chk_projeto_nome   CHECK (length(btrim(nome)) > 0)
);

CREATE INDEX idx_projeto_editorial_editora        ON projeto_editorial (editora_id);
CREATE INDEX idx_projeto_editorial_status         ON projeto_editorial (status);
CREATE INDEX idx_projeto_editorial_atualizado_em  ON projeto_editorial (atualizado_em DESC);

COMMENT ON TABLE  projeto_editorial            IS 'Editorial project (aggregate root, PROJ context). Cascade root for LGPD erasure; sole authority over status (ADR-002).';
COMMENT ON COLUMN projeto_editorial.status     IS 'Authoritative lifecycle status; only PROJ writes it. Transitions via ProjectStatus VO (ADR-002).';
COMMENT ON COLUMN projeto_editorial.editora_id IS 'Logical reference to editora (cordele_global registry); validated application-side (cross-schema, not a DB FK). VARCHAR until the registry exists — not the tenant-routing key (see empresaId).';
```

**Invariants:**

- `IF status is not in {rascunho, em_composicao, publicado, com_erros}, THEN THE SYSTEM SHALL reject the
  row (CHECK chk_projeto_status).`
- `IF nome is blank, THEN THE SYSTEM SHALL reject the row (CHECK chk_projeto_nome).`
- `THE SYSTEM SHALL change status only through the ProjectStatus value object's legal-transition table
  (ADR-002); no other context and no controller writes status directly` (single-writer, R1).
- `WHEN status changes, THE SYSTEM SHALL set atualizado_em = now() and append a projeto_status_historico
  row in the same transaction.`
- `WHEN a projeto_editorial is deleted, THE SYSTEM SHALL cascade-delete its projeto_status_historico`
  (FK ON DELETE CASCADE, §2.2); cross-context rows/binaries are purged by the orchestrated cascade (§5).

### 2.2 `projeto_status_historico` [empresa]

Append-only audit of every actual status change (closes gap G1). It is the evidence trail behind ADR-002
(who requested the change, from what, to what) and the source of the "última atividade" signal on the
library. Written **only** on an actual transition (never on an idempotent no-op); one row per change.

```sql
-- schema: empresa
CREATE TABLE projeto_status_historico (
    id             UUID        NOT NULL DEFAULT gen_random_uuid(),
    projeto_id     UUID        NOT NULL,
    status_de      TEXT,
    status_para    TEXT        NOT NULL,
    solicitado_por TEXT        NOT NULL,
    principal_id   TEXT,
    motivo         TEXT,
    criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    CONSTRAINT chk_psh_status_para   CHECK (status_para IN ('rascunho', 'em_composicao', 'publicado', 'com_erros')),
    CONSTRAINT chk_psh_status_de     CHECK (status_de IS NULL OR status_de IN ('rascunho', 'em_composicao', 'publicado', 'com_erros')),
    CONSTRAINT chk_psh_solicitante   CHECK (solicitado_por IN ('imp', 'pub', 'comp', 'editor', 'system')),
    CONSTRAINT fk_psh_projeto FOREIGN KEY (projeto_id) REFERENCES projeto_editorial (id) ON DELETE CASCADE
);

CREATE INDEX idx_psh_projeto    ON projeto_status_historico (projeto_id);
CREATE INDEX idx_psh_criado_em  ON projeto_status_historico (projeto_id, criado_em DESC);

COMMENT ON TABLE  projeto_status_historico             IS 'Append-only audit of project status transitions (ADR-002 evidence; gap G1). One row per actual change; none on idempotent no-op.';
COMMENT ON COLUMN projeto_status_historico.status_de   IS 'Previous status; NULL for the creation row (rascunho).';
COMMENT ON COLUMN projeto_status_historico.solicitado_por IS 'Requesting context: imp | pub | comp | editor | system.';
```

**Invariants:**

- `WHEN a status transition is applied, THE SYSTEM SHALL insert exactly one projeto_status_historico row
  with status_de = previous status and status_para = new status.`
- `THE SYSTEM SHALL NOT insert a projeto_status_historico row for an idempotent no-op (unchanged status).`
- `WHEN a projeto_editorial is deleted, THE SYSTEM SHALL cascade-delete its history rows (FK ON DELETE
  CASCADE).`

## 3. Publication history is not a table (ADR-003)

Publication history (T08) is assembled at read time from PUB's `Publicacao` records via
`PublicationHistoryPort` (see `contracts/api-contract.md` §6.3, `contracts/integration-contracts.md`).
PROJ stores **no** publication rows, avoiding drift between the history view and PUB's source of truth.
The `PublicacaoHistoryItem` shape (id, epubcheckStatus, totalErros, totalAvisos, erros, arquivoUrl,
criadoEm) mirrors PUB's `Publicacao` (BA `data-model.json`) and is a read contract, not persistence here.

## 4. Relations

```
cordele_global                         emp_<slug>  (tenant schema)
+-------------+                        +---------------------------------+
|  editora    |  1 ── owns ── *        |  projeto_editorial (PROJ, root) |
| (global)    |----(logical ref)-----> |  id (pk)                        |
+-------------+                        +----+----------------------+-----+
                                            | 1                    | 1
                                            | owns (cascade)       | referenced by IMP/COMP/PUB
                                            v *                    v * (FK ON DELETE CASCADE, in their contexts)
                              +----------------------------+   manuscrito (IMP), metadados / configuracao_layout (COMP),
                              | projeto_status_historico   |   publicacao (PUB)
                              | projeto_id ── FK ──────────>|
                              +----------------------------+
```

`editora` (global) is referenced logically. `manuscrito`/`metadados`/`configuracao_layout`/`publicacao`
are owned by IMP/COMP/PUB; their FKs point *to* `projeto_editorial` and give the DB cascade backstop.

## 5. Data lifecycle & LGPD

- **Retention:** a `ProjetoEditorial` is retained for the life of the title; `status` is updated in place.
- **Deletion / erasure (D-G, gap G3):** PROJ owns the delete entry point. Deletion is an **orchestrated,
  leaf-first, in-process cascade** (SPEC-11): purge PUB (`Publicacao` rows **+** ePub/PDF artifacts) →
  COMP (`Metadados`/`ConfiguracaoLayout`) → IMP (`manuscrito` rows **+** binaries/images) → then delete
  `projeto_editorial` (which cascades `projeto_status_historico`). Storage binaries are **not** in the DB,
  so DB `ON DELETE CASCADE` alone is insufficient; each context purges its own storage via its erasure
  port. The FK cascade remains the integrity backstop.
- **Idempotency & recovery:** each per-context purge is idempotent; a partial failure aborts before the
  identity row is removed, leaving the project recoverable and the deletion safely retriable.
- **Confidentiality:** a project groups sensitive unpublished creative work; all access is tenant-scoped
  via `EmpresaContext`, never a caller-supplied id.

## 6. Migration plan

- Tooling: **`prisma migrate`** (`migrationsLocation = per-service`). DDL above → `schema.prisma` models +
  the initial migration.
- **Reserved range:** `V0001__create_projeto_editorial`, `V0002__create_projeto_status_historico`.
- **Schema-per-tenant application:** the DDL is replayed into **every** tenant schema (`emp_<slug>`) by
  the shared tenant-provisioning routine, which also runs it when bootstrapping a new tenant. Because
  `projeto_editorial` is the cascade root referenced by IMP/COMP/PUB FKs, its DDL runs **first** in the
  per-tenant provisioning order (before those contexts' tables). Prisma's single-schema assumption is
  bridged by runtime schema targeting (RULE-07) — a shared platform concern (scaffold/infra, gap A1/G7).

## 7. Schema-level mapping

| Table | Schema class | Owner | Notes |
|---|---|---|---|
| `projeto_editorial` | `emp_<slug>` (tenant) | **PROJ** | this contract; cascade root; sole status writer |
| `projeto_status_historico` | `emp_<slug>` (tenant) | **PROJ** | this contract; append-only audit (G1) |
| `editora` | `cordele_global` | global | referenced logically (tenant registry); not created here |
| `manuscrito` | `emp_<slug>` (tenant) | IMP | references projeto_editorial (FK cascade); not here |
| `metadados` / `configuracao_layout` | `emp_<slug>` (tenant) | COMP | reference projeto_editorial; not here |
| `publicacao` | `emp_<slug>` (tenant) | PUB | source of the history read view (ADR-003); not here |
