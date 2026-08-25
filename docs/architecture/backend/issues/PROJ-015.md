# PROJ-015 -- Outbound erasure port stubs: PublicationErasurePort + CompositionErasurePort + ManuscriptErasurePort

**Status:** INTACT -- gerado 2026-08-25
**Maturidade:** 0 -- Inicial
**Done/Total:** 0/4 itens

## Contexto

PROJ's LGPD erasure use case (PROJ-016) orchestrates purging across PUB, COMP and IMP via three
outbound erasure ports (api-contract §4.6, D-G). Because those contexts may not be scaffolded when
PROJ is developed, **thin no-op stubs** are needed first. Each stub accepts `purge(projetoId)` and
returns `void` — safe to call during development without side effects. The real adapters bind to
sibling purge ports in PROJ-INT-004..006.

This mirrors the pattern used in IMP-INT-001 (PROJ inbound port stubs while PROJ was absent).

## Spec de referencia
- SPEC-11 (cross-context-deletion-lgpd-erasure — purge interface contract)
- api-contract.md §4.6

## Escopo

Files to create (relative to monolith root `backend/`):

- [ ] `src/domain/proj/ports/outbound/publication-erasure.port.ts` — interface: `purge(projetoId: string): Promise<void>`
- [ ] `src/domain/proj/ports/outbound/composition-erasure.port.ts` — interface: `purge(projetoId: string): Promise<void>`
- [ ] `src/domain/proj/ports/outbound/manuscript-erasure.port.ts` — interface: `purge(projetoId: string): Promise<void>`
- [ ] `src/infrastructure/stubs/proj/publication-erasure.stub.ts` — no-op, logs `INFO purge(projetoId) stub — no real PUB binding`
- [ ] `src/infrastructure/stubs/proj/composition-erasure.stub.ts` — no-op, logs `INFO purge(projetoId) stub — no real COMP binding`
- [ ] `src/infrastructure/stubs/proj/manuscript-erasure.stub.ts` — no-op, logs `INFO purge(projetoId) stub — no real IMP binding`
- [ ] `src/modules/proj/proj.module.ts` — register stubs under `PUBLICATION_ERASURE_PORT`, `COMPOSITION_ERASURE_PORT`, `MANUSCRIPT_ERASURE_PORT` DI tokens (update PROJ-001)

## Criterios de aceite

- [ ] All three port interfaces compiled; stubs implement them (TypeScript `implements` clause)
- [ ] `purge(projetoId)` on any stub resolves without error (safe no-op)
- [ ] Stubs are swappable by overriding DI tokens in the NestJS testing module
- [ ] `pnpm build` exits 0 with all 3 stubs registered

## Dependencias

- PROJ-001 (precede — ProjModule DI token declarations)

## Estimativa
S

## Prioridade
P6
