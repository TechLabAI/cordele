# COMP-009 -- Prisma schema.prisma + migrations V0001..V0003 (metadados, configuracao_layout, layout_override)

**Status:** INTACT -- gerado 2026-08-25
**Maturidade:** 0 -- Inicial
**Done/Total:** 0/5 itens

## Contexto

Translates the canonical DDL from `contracts/data-model.md` §2.1–§2.3 into a `schema.prisma`
model block and the three initial Prisma migrations. The FK `ON DELETE CASCADE` from
`metadados` and `configuracao_layout` to `projeto_editorial` is the DB-level backstop for LGPD
erasure (SPEC-04.C6 — must enter the DDL generated here). `layout_override` cascades from
`configuracao_layout`. The `CHECK` constraints for typography bounds and `chk_override_imagem_alinhado`
are emitted as raw SQL in the migration (Prisma does not generate CHECKs natively).

**Dependency on COMP-002 decision:** the migration must match the chosen tenancy option —
if Opção A (schema-per-tenant), each `CREATE TABLE` is applied to `emp_<slug>` via the
provisioning script; if Opção B (single schema), the migration runs in the global schema.

## Spec de referencia
- SPEC-04 (data-model migrations — DDL, CHECKs, FKs ON DELETE CASCADE, UNIQUE)
- `contracts/data-model.md` §2.1–§2.3 (canonical SQL blocks)

## Escopo

Files to create (relative to monolith root `backend/`):

- [ ] `prisma/schema.prisma` — add COMP model blocks: `Metadados` (with `@@unique([projetoId])`, `@relation`), `ConfiguracaoLayout` (with `@@unique([projetoId])`, `@relation` to LayoutOverride), `LayoutOverride` (with `@@unique([configuracaoLayoutId, referencia_no])`); field types match `data-model.md` (UUID pk, TIMESTAMPTZ → `DateTime`, NUMERIC → `Decimal`)
- [ ] `prisma/migrations/V0001__create_metadados.sql` — `CREATE TABLE metadados` with all columns, `UNIQUE`, CHECK constraints (`chk_metadados_titulo`, `_autor`, `_idioma`), FK `REFERENCES projeto_editorial (id) ON DELETE CASCADE`
- [ ] `prisma/migrations/V0002__create_configuracao_layout.sql` — `CREATE TABLE configuracao_layout` with all columns, UNIQUE, CHECK constraints (corpo bounds, espacamento, margem, heading bounds, `chk_cfglayout_heading_order`), FK ON DELETE CASCADE to `projeto_editorial`
- [ ] `prisma/migrations/V0003__create_layout_override.sql` — `CREATE TABLE layout_override` with all columns, `chk_override_tipo`, `chk_override_alinhamento`, `chk_override_imagem_alinhado`, `chk_override_ordem`, FK `REFERENCES configuracao_layout (id) ON DELETE CASCADE`, `uq_override_no UNIQUE(configuracao_layout_id, referencia_no)`
- [ ] Integration test: `pnpm prisma migrate dev` applies all 3 migrations in order against a test DB; no errors

## Criterios de aceite

- [ ] `pnpm prisma migrate dev` exits 0 with V0001..V0003 applied in order
- [ ] `metadados` has FK `ON DELETE CASCADE` to `projeto_editorial` (SPEC-04.C6)
- [ ] `configuracao_layout` has FK `ON DELETE CASCADE` to `projeto_editorial` (SPEC-04.C6)
- [ ] `layout_override` has FK `ON DELETE CASCADE` to `configuracao_layout`
- [ ] `chk_override_imagem_alinhado` CHECK constraint present in V0003 migration

## Dependencias

- COMP-002 (precede — tenancy decision must be made before DDL target is finalized)
- COMP-006 (precede — domain model defines field names/types)

## Estimativa
M

## Prioridade
P3
