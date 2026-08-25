# PROJ-010 -- GetProjetoLibraryUseCase (GET /projetos) batched N+1-free read + degraded fallback + G5 filter reservation

**Status:** INTACT -- gerado 2026-08-25
**Maturidade:** 0 -- Inicial
**Done/Total:** 0/5 itens

## Contexto

Implements `GET /api/proj/projetos` (T02 — biblioteca). For the current empresa, retrieves all
`ProjetoEditorial` rows, then composes `ProjetoCard[]` by calling the three outbound read ports
**once** with the full set of projetoIds — never one call per card (SPEC-03, api-contract §6.4).

**Degraded path:** if any port call throws or times out, the use case catches the error, marks the
affected fields `null`/`0`, and sets `degraded=true` on each affected card. The library **never**
fails because IMP/COMP/PUB is unavailable (SPEC-07).

**G5 filter reservation:** `?status=<enum>` filter is accepted by the controller and passed to the
repository `findAll(filter)` for DB-side filtering. `?limit` and `?cursor` query params are
**declared but not enforced** in the POC — the repository returns all results. This reserves the
API surface without breaking clients when pagination is introduced (SPEC-01 §4.2).

## Spec de referencia
- SPEC-03 (no-N+1 batching, EARS clause for bounded port calls)
- SPEC-07 (degraded:true when port unavailable)
- api-contract.md §4.2, §6.2, §6.4

## Escopo

Files to create (relative to monolith root `backend/`):

- [ ] `src/modules/proj/use-cases/get-projeto-library.use-case.ts` — fetches `ProjetoEditorial[]` via repository; calls `ManuscriptSummaryPort.summaries(ids)`, `ProjectMetadataPort.metadata(ids)`, `PublicationHistoryPort.latest(ids)` **each once** with full id set; assembles `ProjetoCard[]`; each port call is wrapped in try/catch — on failure, `degraded=true` propagated per card, cross-context fields null/0; ordered by `ultimaAtividadeEm DESC`; supports `?status` filter (DB-side)
- [ ] `src/modules/proj/use-cases/get-projeto-library.use-case.spec.ts` — happy path (all ports return data); partial degraded (one port fails — other cards still fully composed); full degraded (all ports fail — own fields still returned); `?status` filter passes to repository
- [ ] `src/modules/proj/proj.controller.ts` — wire `GET /projetos` to use case (update PROJ-001 stub); accept `?status`, `?limit`, `?cursor` query params; return 200 with `ProjetoCard[]`

## Criterios de aceite

- [ ] Three port calls total per request — `ManuscriptSummaryPort`, `ProjectMetadataPort`, `PublicationHistoryPort` each called once with the full `projetoIds` array (verified in spec by call-count assertion on port mocks)
- [ ] When `ManuscriptSummaryPort` throws, cards still return own fields with `totalCapitulos=0, totalImagens=0` and no 500
- [ ] `?status=rascunho` returns only projects in that status (DB filter)
- [ ] `?limit` and `?cursor` accepted without 400 but not enforced in POC (all results returned)
- [ ] `pnpm test` on use case spec exits 0

## Dependencias

- PROJ-008 (precede — ProjetoEditorialRepository.findAll)
- PROJ-009 (precede — outbound port stubs registered)

## Estimativa
M

## Prioridade
P4
