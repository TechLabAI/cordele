# COMP-001 -- NestJS CompModule skeleton + CompController with all 7 REST routes wired

**Status:** INTACT -- gerado 2026-08-25
**Maturidade:** 0 -- Inicial
**Done/Total:** 0/5 itens

## Contexto

Scaffold the NestJS module entry point for Composition. `CompModule` registers the controller,
all use case providers, port DI tokens, and the `EmpresaContext` middleware. `CompController`
wires **all 7 routes** under `/api/comp` — `GET /projetos/:id/metadados`,
`PUT /projetos/:id/metadados`, `POST /projetos/:id/capa`, `DELETE /projetos/:id/capa`,
`GET /projetos/:id/layout`, `PUT /projetos/:id/layout`,
`GET /projetos/:id/preview-context` — returning stub responses so that `pnpm build` passes
before P2 use cases are implemented. Note: inbound ports exported to PUB/PROJ are declared as
DI tokens here but implemented in P6 issues.

## Spec de referencia
- SPEC-01 (api-surface — all 7 routes, DI tokens, scopes)
- `docs/architecture/backend/adr/ADR-001-hexagonal-node.md` (hexagonal boundary: modules layer)

## Escopo

Files to create (relative to monolith root `backend/`):

- [ ] `src/modules/comp/comp.module.ts` — registers `CompController`; declares DI tokens for 7 use cases + 4 inbound ports (`GET_METADADOS_USE_CASE`, `UPDATE_METADADOS_USE_CASE`, `UPLOAD_COVER_USE_CASE`, `REMOVE_COVER_USE_CASE`, `GET_LAYOUT_USE_CASE`, `UPDATE_LAYOUT_USE_CASE`, `GET_LAYOUT_PREVIEW_USE_CASE`) and 6 port tokens (`METADADOS_REPOSITORY`, `CONFIGURACAO_LAYOUT_REPOSITORY`, `MANUSCRIPT_CONTENT_PORT`, `FILE_STORAGE_PORT`, `GET_METADADOS_PORT`, `GET_CONFIGURACAO_LAYOUT_PORT`, `PROJECT_METADATA_PORT`, `COMPOSITION_ERASURE_PORT`); applies `EmpresaContext` middleware
- [ ] `src/modules/comp/comp.tokens.ts` — all Symbol DI token declarations
- [ ] `src/modules/comp/comp.controller.ts` — 7 route handlers under `/api/comp`; stub responses (empty 200/201/204); scopes declared but guards wired as allow-all stubs in P1
- [ ] `src/modules/comp/comp.controller.spec.ts` — unit tests verifying all 7 route handlers return stub HTTP statuses
- [ ] `src/modules/comp/dto/` — `metadados-view.dto.ts`, `update-metadados.dto.ts`, `layout-view.dto.ts`, `update-layout.dto.ts`, `preview-context.dto.ts` matching api-contract §6

## Criterios de aceite

- [x] `pnpm build` exits 0 with `CompModule` present
- [x] All 7 route handlers exist in `CompController` with correct HTTP verbs and paths (verified by controller unit test listing route metadata)
- [x] `@nestjs/swagger` decorators present on each route for OpenAPI generation
- [ ] All DI tokens declared in `comp.tokens.ts`: use cases + outbound ports + inbound ports
- [x] `pnpm test` on the controller spec exits 0

## Dependencias

Nenhuma (primeiro scaffold do módulo COMP).

## Estimativa
M

## Prioridade
P1
