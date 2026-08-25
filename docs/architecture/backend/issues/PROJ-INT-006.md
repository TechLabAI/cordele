# PROJ-INT-006 -- PublicationErasurePort real adapter binding to PUB purge port

**Status:** INTACT -- gerado 2026-08-25
**Maturidade:** 0 -- Inicial
**Done/Total:** 0/3 itens

## Contexto

Replaces the `PublicationErasurePort` stub (PROJ-015) with a real adapter calling PUB's in-process
purge port. PUB's purge deletes `Publicacao` rows **and** ePub/PDF artifacts from object storage
(via PUB's own `FileStoragePort`). Idempotent: no-op when no publications exist for the project.

This is the **first** step in the LGPD leaf-first cascade (PROJ-016): PUB purge runs before COMP
and IMP so that digital artifacts are removed from storage before any row-level data is deleted.

## Spec de referencia
- SPEC-11 (cross-context-deletion, step 1: PUB purge — first because PUB holds external storage artifacts)
- api-contract.md §4.6

## Escopo

Files to create (relative to monolith root `backend/`):

- [ ] `src/infrastructure/proj/erasure/publication-erasure.adapter.ts` — implements `PublicationErasurePort`; calls PUB's `PublicacaoErasurePort.purgeByProjeto(projetoId)` (PUB deletes rows + storage artifacts internally); idempotent; on PUB unavailability: rethrows
- [ ] `src/infrastructure/proj/erasure/publication-erasure.adapter.spec.ts` — PUB port purges; PUB port no-ops on empty; PUB port throws → rethrows
- [ ] `src/modules/proj/proj.module.ts` — register real adapter under `PUBLICATION_ERASURE_PORT` when PUB is scaffolded

## Criterios de aceite

- [ ] `purge(projetoId)` calls PUB's purge port once
- [ ] `purge(projetoId)` for a project with no publications completes without error (idempotent)
- [ ] PUB port failure: adapter rethrows; PROJ-016 aborts and leaves `projeto_editorial` intact
- [ ] `pnpm test` on adapter spec exits 0

## Dependencias

- PROJ-015 (precede — PublicationErasurePort interface)
- PROJ-016 (precede — erasure use case; this is the first step in its cascade)
- PUB exported purge port (PUB scaffolded)

## Estimativa
S

## Prioridade
P6
