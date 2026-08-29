# PROJ-INT-004 -- ManuscriptErasurePort real adapter binding to IMP purge port

**Status:** REDUCED -- pos-validacao 2026-08-28
**Maturidade:** 73 -- Consistente
**Done/Total:** 3/7 itens

## Contexto

Replaces the `ManuscriptErasurePort` stub (PROJ-015) with a real adapter calling IMP's in-process
purge port. IMP's purge deletes `manuscrito` rows **and** stored binaries (DOCX/images from
`FileStoragePort` in IMP). The adapter must be idempotent: if there are no manuscripts for the
project, `purge(projetoId)` must return without error (safe no-op).

This adapter is the third step in the LGPD leaf-first cascade (PROJ-016): IMP purge runs after PUB
and COMP purge, immediately before the `projeto_editorial` identity row is deleted.

## Spec de referencia
- SPEC-11 (cross-context-deletion, step 3: IMP purge)
- integration-contracts.md §2 (erasure port contract)
- api-contract.md §4.6

## Escopo

Files to create (relative to monolith root `backend/`):

- [ ] `src/infrastructure/proj/erasure/imp-manuscript-erasure.adapter.ts` — implements `ManuscriptErasurePort`; calls IMP's exported `ManuscritoErasurePort` via its `erase(projetoId, empresaId)` method; idempotent (IMP port returns cleanly when no manuscripts exist); on IMP unavailability: rethrows (caller in PROJ-016 aborts and returns 502)
- [ ] `src/infrastructure/proj/erasure/imp-manuscript-erasure.adapter.spec.ts` — IMP port erases; IMP port no-ops on empty; IMP port throws → adapter rethrows
- [ ] `src/modules/proj/proj.module.ts` — register real adapter under `MANUSCRIPT_ERASURE_PORT` when IMP is scaffolded

## Criterios de aceite

- [ ] `erase(projetoId, empresaId)` calls IMP's erase port exactly once
- [ ] `erase(projetoId, empresaId)` for a project with no manuscripts completes without error (idempotent)
- [ ] IMP port unavailability: adapter rethrows; PROJ-016 catches and returns 502
- [ ] `pnpm test` on adapter spec exits 0

## Dependencias

- PROJ-015 (precede — ManuscriptErasurePort interface exists)
- PROJ-016 (precede — erasure use case uses this adapter)
- IMP exported purge port (IMP scaffolded)

## Estimativa
S

## Prioridade
P6
