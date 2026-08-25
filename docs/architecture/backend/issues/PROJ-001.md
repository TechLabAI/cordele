# PROJ-001 -- NestJS ProjModule skeleton + ProjController with all 7 routes wired

**Status:** INTACT -- gerado 2026-08-25
**Maturidade:** 0 -- Inicial
**Done/Total:** 0/5 itens

## Contexto

Scaffold the NestJS module entry point for Projects. `ProjModule` registers the controller,
all use case providers, port DI tokens, and the `EmpresaContext` middleware. `ProjController`
wires **all 7 routes** — `POST /projetos`, `GET /projetos`, `GET /projetos/:id`,
`GET /projetos/:id/publicacoes`, `GET /projetos/:id/publicacoes/:pid/download`,
`DELETE /projetos/:id`, `POST /projetos/:id/reopen` — returning stub responses so that
`pnpm build` passes and the smoke route is available before P2 use cases are implemented.

## Spec de referencia
- SPEC-01 (api-contract.md §4, §6)
- docs/architecture/backend/adr/ADR-001-hexagonal-node.md (hexagonal boundary: modules layer)

## Escopo

Files to create (relative to monolith root `backend/`):

- [ ] `src/modules/proj/proj.module.ts` — registers ProjController; declares DI tokens for 4 use cases (create, advance, reopen, library) + 6 outbound ports; applies `EmpresaContext` middleware
- [ ] `src/modules/proj/proj.controller.ts` — 7 route handlers under `/api/proj`: `POST /projetos`, `GET /projetos`, `GET /projetos/:projetoId`, `GET /projetos/:projetoId/publicacoes`, `GET /projetos/:projetoId/publicacoes/:publicacaoId/download`, `DELETE /projetos/:projetoId`, `POST /projetos/:projetoId/reopen`; stub responses (empty 200/201/204)
- [ ] `src/modules/proj/proj.controller.spec.ts` — unit tests verifying all 7 route handlers are registered and return the stub HTTP status
- [ ] `src/modules/proj/dto/create-projeto.dto.ts` — `{ nome: string; descricao?: string }`
- [ ] `src/modules/proj/dto/projeto-detail.dto.ts`, `projeto-card.dto.ts`, `publicacao-history-item.dto.ts`, `signed-download-url.dto.ts` — response shape stubs matching api-contract §6

## Criterios de aceite

- [x] `pnpm build` exits 0 with ProjModule present
- [x] All 7 route handlers exist in ProjController (verified by controller unit test listing route metadata)
- [x] `@nestjs/swagger` decorators present on each route for OpenAPI generation
- [x] DI tokens declared: `CREATE_PROJETO_USE_CASE`, `ADVANCE_PROJETO_STATUS_USE_CASE`, `REOPEN_PROJECT_USE_CASE`, `GET_PROJETO_LIBRARY_USE_CASE`, `GET_PROJETO_DETAIL_USE_CASE`, `GET_PUBLICATION_HISTORY_USE_CASE`, `GET_SIGNED_DOWNLOAD_URL_USE_CASE`, `DELETE_PROJETO_USE_CASE`, `MANUSCRIPT_SUMMARY_PORT`, `PROJECT_METADATA_PORT`, `PUBLICATION_HISTORY_PORT`, `PUBLICATION_ERASURE_PORT`, `COMPOSITION_ERASURE_PORT`, `MANUSCRIPT_ERASURE_PORT`
- [x] `pnpm test` on the controller spec exits 0

## Dependencias

Nenhuma (primeiro scaffold do módulo).

## Estimativa
M

## Prioridade
P1
