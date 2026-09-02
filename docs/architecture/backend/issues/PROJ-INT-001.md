# PROJ-INT-001 -- ManuscriptSummaryPort real adapter binding to IMP in-process query port (stub to real)

**Status:** REDUCED -- pos-validacao 2026-08-28
**Maturidade:** 73 -- Consistente
**Done/Total:** 3/7 itens

## Contexto

Replaces the `ManuscriptSummaryPort` stub (PROJ-009) with a real adapter that calls IMP's
in-process query port to retrieve the latest manuscript summary per project. The adapter is
registered behind the same DI token (`MANUSCRIPT_SUMMARY_PORT`) and is switched in by
environment flag or module configuration once IMP is scaffolded.

The adapter calls IMP's exported query port `ManuscritoQueryPort.latestByProjetoIds(projetoIds)`
(or equivalent in-process provider) in a **single batched call** — same batching invariant as the
stub. On IMP unavailability (port throws), the adapter surfaces `degraded=true` for affected
projects — the use case (PROJ-010, PROJ-011) already handles this.

## Spec de referencia
- integration-contracts.md §2.1 (ManuscriptSummaryPort signature + fallback)
- SPEC-03 (batching constraint)
- SPEC-10 (integration scenarios — port call count)

## Escopo

Files to create (relative to monolith root `backend/`):

- [ ] `src/infrastructure/proj/read/manuscript-summary.adapter.ts` — implements `ManuscriptSummaryPort`; injects IMP's in-process query provider by DI token; calls `summaries(projetoIds)` in one call; maps IMP's response shape to `ManuscriptSummary` (totalCapitulos, totalImagens, trechosNaoParseados, criadoEm); on error: returns empty Map (caller marks degraded)
- [ ] `src/infrastructure/proj/read/manuscript-summary.adapter.spec.ts` — IMP port mock returns data for 2 projects; adapter maps correctly; IMP port throws → adapter returns empty Map without rethrowing
- [ ] `src/modules/proj/proj.module.ts` — add env-flag switch: when IMP module is present, register real adapter under `MANUSCRIPT_SUMMARY_PORT` instead of stub

## Criterios de aceite

- [x] `summaries(projetoIds)` makes exactly 1 call to IMP's query port regardless of `projetoIds.length`
- [x] Correct shape mapping: IMP `totalCapitulos` → `ManuscriptSummary.totalCapitulos`
- [x] IMP port unavailability returns empty `Map` (not thrown error) — callers degrade gracefully
- [ ] `pnpm test` on adapter spec exits 0

## Dependencias

- PROJ-009 (precede — port interface and stub must exist; real adapter replaces stub)
- IMP-010 or equivalent (IMP must export its manuscript query port)

## Estimativa
M

## Prioridade
P4
