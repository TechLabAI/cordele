# PROJ-INT-005 -- CompositionErasurePort real adapter binding to COMP purge port

**Status:** INTACT -- gerado 2026-08-25
**Maturidade:** 0 -- Inicial
**Done/Total:** 0/3 itens

## Contexto

Replaces the `CompositionErasurePort` stub (PROJ-015) with a real adapter calling COMP's in-process
purge port. COMP's purge deletes `Metadados` and `ConfiguracaoLayout` rows for the project.
Idempotent: no-op when no COMP data exists for the project.

This adapter is the second step in the LGPD leaf-first cascade (PROJ-016): COMP purge runs after
PUB purge and before IMP purge.

## Spec de referencia
- SPEC-11 (cross-context-deletion, step 2: COMP purge)
- api-contract.md §4.6

## Escopo

Files to create (relative to monolith root `backend/`):

- [ ] `src/infrastructure/proj/erasure/composition-erasure.adapter.ts` — implements `CompositionErasurePort`; calls COMP's `MetadataErasurePort.purgeByProjeto(projetoId)`; idempotent; on COMP unavailability: rethrows
- [ ] `src/infrastructure/proj/erasure/composition-erasure.adapter.spec.ts` — COMP port purges; COMP port no-ops on empty; COMP port throws → rethrows
- [ ] `src/modules/proj/proj.module.ts` — register real adapter under `COMPOSITION_ERASURE_PORT` when COMP is scaffolded

## Criterios de aceite

- [ ] `purge(projetoId)` calls COMP's purge port once
- [ ] `purge(projetoId)` for a project with no COMP data completes without error
- [ ] COMP port failure: adapter rethrows; PROJ-016 aborts with 502
- [ ] `pnpm test` on adapter spec exits 0

## Dependencias

- PROJ-015 (precede — CompositionErasurePort interface)
- PROJ-016 (precede — erasure use case)
- COMP exported purge port (COMP scaffolded)

## Estimativa
S

## Prioridade
P6
