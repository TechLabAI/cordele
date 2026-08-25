# PROJ-007 -- Prisma schema models + initial migrations V0001-V0002 (ProjetoEditorial + ProjetoStatusHistorico)

**Status:** INTACT -- gerado 2026-08-25
**Maturidade:** 0 -- Inicial
**Done/Total:** 0/5 itens

## Contexto

Defines the Prisma models for the two PROJ tables and generates the initial migration.
The DDL is **canonical** in `data-model.md` §2.1 and §2.2; this issue translates it to
`schema.prisma` and the initial migration files. Both tables live in the **tenant schema**
(`emp_<slug>`) — the Prisma adapter must target the schema resolved from `EmpresaContext` (RULE-07).

`projeto_editorial` is the cascade root: IMP/COMP/PUB declare `FK (projeto_id) REFERENCES
projeto_editorial(id) ON DELETE CASCADE` in their own migrations. `projeto_status_historico`
declares `FK (projeto_id) REFERENCES projeto_editorial(id) ON DELETE CASCADE` here.

Reserved migration range: `V0001__create_projeto_editorial`, `V0002__create_projeto_status_historico`.

## Spec de referencia
- SPEC-04 (data-model-migrations) — full DDL with CHECKs and indexes
- data-model.md §2.1, §2.2, §6

## Escopo

Files to create (relative to monolith root `backend/`):

- [ ] `prisma/schema.prisma` — add `ProjetoEditorial` model (id, editoraId, nome, status, descricao, criadoEm, atualizadoEm) and `ProjetoStatusHistorico` model (id, projetoId FK ON DELETE CASCADE, statusDe, statusPara, solicitadoPor, principalId, motivo, criadoEm); enum `ProjetoStatus { rascunho em_composicao publicado com_erros }` and `SolicitadoPor { imp pub comp editor system }`; `@@index` decorators matching data-model.md indexes
- [ ] `prisma/migrations/0001_create_projeto_editorial/migration.sql` — `CREATE TABLE projeto_editorial` with all CHECKs, indexes, comments from data-model.md §2.1
- [ ] `prisma/migrations/0002_create_projeto_status_historico/migration.sql` — `CREATE TABLE projeto_status_historico` with FK cascade, CHECKs, indexes, comments from data-model.md §2.2

## Criterios de aceite

- [ ] `prisma migrate dev` runs without error and creates both tables
- [ ] `CHECK (status IN ('rascunho','em_composicao','publicado','com_erros'))` present on `projeto_editorial`
- [ ] `CHECK (solicitado_por IN ('imp','pub','comp','editor','system'))` present on `projeto_status_historico`
- [ ] FK `fk_psh_projeto` has `ON DELETE CASCADE` in migration SQL
- [ ] Three indexes on `projeto_editorial` (`editora_id`, `status`, `atualizado_em DESC`) match data-model.md
- [ ] `pnpm build` exits 0 with generated Prisma client

## Dependencias

- PROJ-001 (precede — module must exist to contextualise the schema)

## Estimativa
M

## Prioridade
P3
