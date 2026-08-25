# INT-COMP-004 -- ProjectMetadataPort real adapter — PROJ library/detail batched author lookup

**Status:** INTACT -- gerado 2026-08-25
**Maturidade:** 0 -- Inicial
**Done/Total:** 0/3 itens

## Contexto

Wires PROJ's injection of `PROJECT_METADATA_PORT` from `CompModule` so that PROJ's library
(T02) and project detail (T08) queries can retrieve composed `autor` per project in a single
batched call. Replaces any PROJ-side stub of the `ProjectMetadataPort` with the real
in-process call to COMP-017's `ProjectMetadataPort.metadata(projetoIds)`. On COMP
unavailability, PROJ degrades gracefully: `autor=null`, `degraded=true` on affected library
cards (established in PROJ's use case logic, not changed here).

## Spec de referencia
- `contracts/integration-contracts.md` §1.3 (ProjectMetadataPort — batched, N+1 forbidden)
- SPEC-10 (integrations — §1.3)
- PROJ SPEC-03 (batching constraint — exactly 1 call per library fetch)

## Escopo

Files to create / amend (relative to monolith root `backend/`):

- [ ] `src/modules/proj/proj.module.ts` (amend) — import `CompModule`; inject `PROJECT_METADATA_PORT` token into PROJ's library use case; replace PROJ's existing `ProjectMetadataPort` stub (PROJ-009) with COMP's real implementation
- [ ] `test/comp-proj-integration.spec.ts` — integration test: seed 3 projects; 2 have composed metadata, 1 does not; call library use case; verify 1 DB call to COMP (batched); verify `autor` present for 2, absent for 1; no N+1 DB queries

## Criterios de aceite

- [ ] Library call for 10 projects makes exactly 1 COMP `metadata()` call (batch, no N+1)
- [ ] Project without composed metadata → `autor=null` in library card; `degraded=false` (expected absence)
- [ ] COMP `metadata()` throwing → PROJ degrades gracefully (`degraded=true`), no crash
- [ ] `pnpm test` on integration spec exits 0

## Dependencias

- COMP-017 (precede — `ProjectMetadataPort` implementation and DI token exported)
- PROJ-009 (precede — PROJ stub port must exist to be replaced)

## Estimativa
M

## Prioridade
P6
