# COMP-017 -- ProjectMetadataPort + CompositionErasurePort export wiring for PROJ (inbound ports)

**Status:** INTACT -- gerado 2026-08-25
**Maturidade:** 0 -- Inicial
**Done/Total:** 0/4 itens

## Contexto

Implements and exports the two inbound ports PROJ calls:
`ProjectMetadataPort.metadata(projetoIds)` for batched author lookup (library T02/detail T08)
and `CompositionErasurePort.purge(projetoId)` for the LGPD leaf-first erasure cascade.

`ProjectMetadataPort.metadata` is **batched by projetoId set** — a single DB query for all
project ids, no N+1 — returning `Map<projetoId, { autor?: string }>`. Projects with no
composed metadata are omitted from the map; PROJ degrades gracefully on omission.

`CompositionErasurePort.purge` idempotently deletes `metadados`, `configuracao_layout` (overrides
cascade via FK), and the cover binary via `FileStoragePort.delete`. Already-absent data is a no-op
(SPEC-10 / SPEC-05).

## Spec de referencia
- SPEC-10 (integrations — §1.3 ProjectMetadataPort, §1.4 CompositionErasurePort)
- `contracts/integration-contracts.md` §1.3–§1.4
- SPEC-05 (idempotency — purge no-op on absent data)

## Escopo

Files to create (relative to monolith root `backend/`):

- [ ] `src/modules/comp/application/project-metadata.use-case.ts` — `metadata(projetoIds: string[]): Promise<Map<string, { autor?: string }>>`: single `prisma.metadados.findMany({ where: { projetoId: { in: projetoIds } } })`; builds map; projects with no row omitted
- [ ] `src/modules/comp/application/composition-erasure.use-case.ts` — `purge(projetoId: string): Promise<void>`: load `Metadados`; if `capaUrl`, call `FileStoragePort.delete(capaUrl)` (idempotent if file missing); `prisma.$transaction`: delete `metadados` row (cascade removes layout + overrides); no-op if already absent
- [ ] `src/modules/comp/comp.module.ts` (amend) — export both use cases under `PROJECT_METADATA_PORT` and `COMPOSITION_ERASURE_PORT` tokens so `ProjModule` can inject
- [ ] `src/modules/comp/application/composition-erasure.use-case.spec.ts` — purge existing project → rows deleted + FileStoragePort.delete called; purge already-absent → no-op, no error; FileStoragePort.delete on missing file → purge still completes

## Criterios de aceite

- [ ] `metadata([id1, id2])` makes exactly 1 DB query regardless of input length
- [ ] `purge(projetoId)` called twice on same project → second call is a no-op (no error)
- [ ] `purge` calls `FileStoragePort.delete(capaUrl)` before deleting DB rows
- [ ] Both ports exported from `CompModule` and injectable by `ProjModule` by DI token
- [ ] `pnpm test` on erasure spec exits 0

## Dependencias

- COMP-004 (precede — MetadadosRepository)
- COMP-005 (precede — FileStoragePort interface)
- COMP-009 (precede — migrations for integration test)

## Estimativa
M

## Prioridade
P6
