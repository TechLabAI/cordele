# PROJ-006 -- Inbound port DI provider registry (4 ports exported for IMP, PUB, and editor callers)

**Status:** NEAR-CLOSED -- pos-validacao 2026-08-28
**Maturidade:** 86 -- Maduro
**Done/Total:** 7/8 itens

## Contexto

PROJ's public contract is 4 inbound ports, exported as NestJS providers under stable DI tokens,
so IMP and PUB can inject them without importing `ProjModule` internals (ADR-001). This issue
wires the real use case implementations (from PROJ-003..005) behind those tokens, replacing the
stubs provisioned by PROJ-001. IMP's `IMP-INT-001` stubs `CreateProjetoEditorialUseCase` and
`ProjetoEditorialLookup` while PROJ is being built; this issue delivers the real providers that
will replace those stubs.

The 4 ports (integration-contracts.md §1):
1. `CreateProjetoEditorialUseCase` — called by IMP create-and-upload
2. `ProjetoEditorialLookup` — called by IMP to validate projetoId
3. `AdvanceProjetoStatusUseCase` — called by IMP (confirm-estrutura) and PUB (export result)
4. `ReopenProjectForRevisionUseCase` — called by editor REST (PROJ-005) and optionally COMP

## Spec de referencia
- integration-contracts.md §1
- api-contract.md §6.5

## Escopo

Files to create/modify (relative to monolith root `backend/`):

- [ ] `src/modules/proj/proj.module.ts` — update PROJ-001 deliverable: export all 4 use cases as providers under their DI tokens; mark them `exports` so the AppModule can make them available to other module DI contexts
- [ ] `src/domain/proj/ports/inbound/create-projeto-editorial.port.ts` — interface `create({ titulo: string }): Promise<{ projetoId: string }>`
- [ ] `src/domain/proj/ports/inbound/projeto-editorial-lookup.port.ts` — interface `exists(projetoId: string): Promise<boolean>`
- [ ] `src/infrastructure/proj/lookup/projeto-editorial-lookup.adapter.ts` — adapter calling `ProjetoEditorialRepository.existsByIdAndEmpresa(projetoId, empresaSlug)`

## Criterios de aceite

- [x] `ProjModule.exports` includes all 4 DI tokens: `CREATE_PROJETO_USE_CASE`, `PROJETO_EDITORIAL_LOOKUP`, `ADVANCE_PROJETO_STATUS_USE_CASE`, `REOPEN_PROJECT_USE_CASE`
- [x] IMP can inject `CREATE_PROJETO_USE_CASE` via `@Inject(CREATE_PROJETO_USE_CASE)` and call `create({ titulo })` returning `{ projetoId }`
- [x] `ProjetoEditorialLookup.exists(projetoId)` returns `false` for a project of another empresa (cross-tenant safety)
- [x] `pnpm build` exits 0 with ProjModule exporting all 4 providers

## Dependencias

- PROJ-003 (precede — CreateProjetoEditorialUseCase implementation)
- PROJ-004 (precede — AdvanceProjetoStatusUseCase implementation)
- PROJ-005 (precede — ReopenProjectForRevisionUseCase implementation)
- PROJ-008 (precede — ProjetoEditorialRepository for ProjetoEditorialLookup)

## Estimativa
S

## Prioridade
P2
