# INT-COMP-001 -- ManuscriptContentPort real adapter binding to IMP in-process query port (stub → real)

**Status:** INTACT -- gerado 2026-08-25
**Maturidade:** 0 -- Inicial
**Done/Total:** 0/4 itens

## Contexto

Replaces the `ManuscriptContentPort` stub adapter (COMP-014) with a real adapter that calls
IMP's exported in-process query port for `getContentTree` and `nodeExists`. The adapter is
registered behind the same DI token (`MANUSCRIPT_CONTENT_PORT`) and is switched in once IMP
is scaffolded and exports its content query provider. COMP reads the manuscript content tree
**read-only** — it never writes IMP data (ADR-002 / D-K).

The adapter wraps IMP's query port in the COMP domain model: it maps IMP's
`ManuscritoQueryPort.getContentTree(projetoId)` response to `{ manuscritoId, estrutura: ContentNode[] }`.
On IMP unavailability (port throws or not yet initialized), the adapter returns `null` for
`getContentTree` (triggers 409 at preview) and `false` for `nodeExists` (triggers 422 at override
write) — consistent with COMP's degradation contract (SPEC-07).

## Spec de referencia
- `contracts/integration-contracts.md` §2.1 (ManuscriptContentPort — getContentTree, nodeExists, fallback)
- SPEC-10 (integrations — COMP never writes IMP data)
- SPEC-03 (layout overrides — nodeExists validation; stale detection)

## Escopo

Files to create (relative to monolith root `backend/`):

- [ ] `src/infrastructure/comp/manuscript/imp-manuscript-content.adapter.ts` — implements `ManuscriptContentPort`; injects IMP's `MANUSCRIPT_QUERY_PORT` (or equivalent) by DI token; `getContentTree`: calls IMP query, maps response; on error returns null; `nodeExists`: calls IMP query for node lookup; on error returns false (fail-safe)
- [ ] `src/infrastructure/comp/manuscript/imp-manuscript-content.adapter.spec.ts` — IMP port mock returns tree for known projetoId; adapter maps correctly; IMP port throws → getContentTree returns null; nodeExists returns false
- [ ] `src/modules/comp/comp.module.ts` (amend) — when IMP module present AND `COMP_USE_STUB_MANUSCRIPT != true`, register `ImpManuscriptContentAdapter` under `MANUSCRIPT_CONTENT_PORT` replacing stub

## Criterios de aceite

- [ ] Real adapter passes same contract as stub: `getContentTree` returns `{ manuscritoId, estrutura }` or `null`; `nodeExists` returns boolean
- [ ] IMP query port unavailability → `getContentTree` returns null (409 at preview, not 500); `nodeExists` returns false (422 at override write)
- [ ] COMP never calls any IMP write method (verified in adapter code review — no mutation calls)
- [ ] `pnpm test` on adapter spec exits 0

## Dependencias

- COMP-014 (precede — stub must exist; real adapter replaces it)
- IMP-010 or equivalent (IMP must export `ManuscritoQueryPort` in-process)

## Estimativa
M

## Prioridade
P4
