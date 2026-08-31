# COMP-010 -- MetadadosRepository Prisma adapter (upsert idempotente by projetoId)

**Status:** INTACT -- gerado 2026-08-25
**Maturidade:** 0 -- Inicial
**Done/Total:** 0/4 itens

## Contexto

Implements `MetadadosRepository` port (declared in COMP-004) against the Prisma client. The
`upsert` operation uses `prisma.metadados.upsert({ where: { projetoId }, create: ..., update: ... })`
so identical re-sends are idempotent at the DB layer (no duplicate row, consistent with
SPEC-05 and the UNIQUE constraint). The adapter maps Prisma records to domain `Metadados`
aggregate instances and vice versa. `findByProjetoId` returns `null` when no row exists
(use case handles lazy default). The Prisma client instance is resolved from the `EmpresaContext`
target schema (COMP-012 wires this; until then the adapter uses the default schema).

## Spec de referencia
- SPEC-04 (data-model — UNIQUE(projeto_id), upsert semantics)
- SPEC-05 (idempotency — no-op on re-send; lazy materialization)
- `contracts/data-model.md` §2.1

## Escopo

Files to create (relative to monolith root `backend/`):

- [ ] `src/infrastructure/comp/persistence/metadados.repository.ts` — implements `MetadadosRepository`; uses `prisma.metadados.upsert`; maps DB record → `Metadados` aggregate (snake_case → camelCase, `materialized=true` on persisted row); `findByProjetoId` uses `prisma.metadados.findUnique({ where: { projetoId } })`
- [ ] `src/infrastructure/comp/persistence/metadados.repository.spec.ts` — integration test against test DB (or PrismaService mock): upsert creates on first call; upsert updates on second call without duplicate; findByProjetoId returns null on absence
- [ ] `src/modules/comp/comp.module.ts` — register `MetadadosRepository` under `METADADOS_REPOSITORY` token (replace stub from COMP-001)

## Criterios de aceite

- [x] Two `upsert` calls with same `projetoId` but different `titulo` result in exactly 1 row with second `titulo`
- [x] `findByProjetoId` on absent project returns `null` (never throws)
- [x] Mapped domain aggregate has `materialized=true`
- [x] `pnpm test` on repository spec exits 0

## Dependencias

- COMP-004 (precede — `MetadadosRepository` port interface declared)
- COMP-009 (precede — migrations must have run for integration test)

## Estimativa
M

## Prioridade
P3
