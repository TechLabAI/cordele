# COMP-011 -- ConfiguracaoLayoutRepository Prisma adapter (atomic override set replacement)

**Status:** INTACT -- gerado 2026-08-25
**Maturidade:** 0 -- Inicial
**Done/Total:** 0/4 itens

## Contexto

Implements `ConfiguracaoLayoutRepository` port (declared in COMP-007) against Prisma. The key
challenge is the atomic override set replacement: `PUT layout` treats the request body as the
complete truth, so the adapter must **delete all existing `layout_override` rows** for the
project and **insert the new set** in a single Prisma transaction. This prevents partial state
where old overrides survive alongside new ones. The `UNIQUE uq_override_no` constraint provides
the DB-level dedup backstop within the new set.

## Spec de referencia
- SPEC-03 (layout — atomic override set; no partial state)
- SPEC-05 (idempotency — identical re-send yields same result)
- `contracts/data-model.md` §2.2–§2.3 (configuracao_layout + layout_override FK cascade)

## Escopo

Files to create (relative to monolith root `backend/`):

- [ ] `src/infrastructure/comp/persistence/configuracao-layout.repository.ts` — implements `ConfiguracaoLayoutRepository`; `upsert(layout)`: wraps in `prisma.$transaction`: upsert `configuracao_layout` row; `deleteMany` all `layout_override` for `configuracaoLayoutId`; `createMany` new override rows; returns mapped `ConfiguracaoLayout` aggregate; `findByProjetoId` loads layout + overrides (ordered by `ordem`)
- [ ] `src/infrastructure/comp/persistence/configuracao-layout.repository.spec.ts` — integration test: upsert creates; second upsert with different overrides → previous overrides gone, new set present; `findByProjetoId` null on absence; override order preserved by `ordem`
- [ ] `src/modules/comp/comp.module.ts` — register real adapter under `CONFIGURACAO_LAYOUT_REPOSITORY` token

## Criterios de aceite

- [ ] After two `upsert` calls with different override sets, only the second set's overrides exist
- [ ] Entire override replacement executes in a single DB transaction (no partial state possible)
- [ ] `findByProjetoId` loads overrides ordered by `ordem` ascending
- [ ] `pnpm test` on repository spec exits 0

## Dependencias

- COMP-007 (precede — `ConfiguracaoLayoutRepository` port interface declared)
- COMP-009 (precede — migrations must have run)

## Estimativa
M

## Prioridade
P3
