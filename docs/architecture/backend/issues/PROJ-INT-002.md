# PROJ-INT-002 -- ProjectMetadataPort real adapter binding to COMP in-process query port (stub to real)

**Status:** INTACT -- gerado 2026-08-25
**Maturidade:** 0 -- Inicial
**Done/Total:** 0/4 itens

## Contexto

Replaces the `ProjectMetadataPort` stub (PROJ-009) with a real adapter calling COMP's in-process
query port to retrieve composed metadata (author) per project. Registered under the same DI token
(`PROJECT_METADATA_PORT`); switched in once COMP is scaffolded.

Returns `{ autor?: string }` per project — `autor` is absent until COMP has composed metadata for
a project. On COMP unavailability, returns empty Map; callers set `degraded=true`.

## Spec de referencia
- integration-contracts.md §2.2 (ProjectMetadataPort signature + fallback)
- SPEC-03 (batching)

## Escopo

Files to create (relative to monolith root `backend/`):

- [ ] `src/infrastructure/proj/read/project-metadata.adapter.ts` — implements `ProjectMetadataPort`; calls COMP's exported `MetadataQueryPort.metadataByProjetoIds(projetoIds)` in one call; maps to `Map<projetoId, { autor? }>`; on error: returns empty Map
- [ ] `src/infrastructure/proj/read/project-metadata.adapter.spec.ts` — COMP port returns data; adapter maps correctly; COMP port throws → empty Map returned
- [ ] `src/modules/proj/proj.module.ts` — env-flag switch to register real adapter under `PROJECT_METADATA_PORT`

## Criterios de aceite

- [ ] `metadata(projetoIds)` makes exactly 1 call to COMP's query port
- [ ] `autor=undefined` for projects with no COMP metadata (not an error)
- [ ] COMP unavailability returns empty `Map` — no rethrow
- [ ] `pnpm test` on adapter spec exits 0

## Dependencias

- PROJ-009 (precede — port interface exists)
- COMP exported metadata query port (COMP scaffolded)

## Estimativa
S

## Prioridade
P4
