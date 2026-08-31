# PROJ-011 -- GetProjetoDetailUseCase (GET /projetos/{id}) composed cross-context fields with degraded:true

**Status:** REDUCED -- pos-validacao 2026-08-28
**Maturidade:** 73 -- Consistente
**Done/Total:** 3/7 itens

## Contexto

Implements `GET /api/proj/projetos/{projetoId}` (T08 header / detail view). Loads the project's
own aggregate then composes `ProjetoDetail` by calling all three outbound read ports:
- `ManuscriptSummaryPort.summaries([projetoId])` → `manuscriptSummary`
- `ProjectMetadataPort.metadata([projetoId])` → `metadata.autor`
- `PublicationHistoryPort.history(projetoId)` → `publicationHistory`

Each port call is independently fault-tolerant: if PUB is unavailable, `publicationHistory=[]`
and `degraded=true`; the authoritative `status` from PROJ own row is always returned.

## Spec de referencia
- SPEC-03 (read composition, degraded path)
- SPEC-07 (degraded:true logging)
- api-contract.md §4.3, §6.1

## Escopo

Files to create (relative to monolith root `backend/`):

- [ ] `src/modules/proj/use-cases/get-projeto-detail.use-case.ts` — loads project via repository (returns 404 if absent or cross-tenant); calls 3 ports individually; assembles `ProjetoDetail`; each port wrapped in try/catch; `degraded=true` if any port fails; `manuscriptSummary=null` when IMP unavailable, `publicationHistory=[]` when PUB unavailable, `metadata={autor:null}` when COMP unavailable
- [ ] `src/modules/proj/use-cases/get-projeto-detail.use-case.spec.ts` — full compose; PUB unavailable → `publicationHistory=[]`, `degraded=true`; unknown projetoId → 404; cross-tenant projetoId → 404
- [ ] `src/modules/proj/proj.controller.ts` — wire `GET /projetos/:projetoId` to use case (update PROJ-001 stub); 404 on not found

## Criterios de aceite

- [ ] `GET /projetos/{id}` returns `ProjetoDetail` with `status` from PROJ own row always present
- [ ] When PUB unavailable, returns `publicationHistory=[]` and `degraded=true` — no 500
- [ ] Cross-tenant projetoId returns 404 (never leaks cross-tenant existence)
- [ ] `pnpm test` on use case spec exits 0

## Dependencias

- PROJ-008 (precede — ProjetoEditorialRepository.findById)
- PROJ-009 (precede — outbound port stubs)
- PROJ-012 (follows — publication history list is a sibling endpoint, separate use case)

## Estimativa
M

## Prioridade
P4
