# PROJ-003 -- CreateProjetoEditorialUseCase (POST /projetos golden path + ProjectCreated event)

**Status:** INTACT -- gerado 2026-08-25
**Maturidade:** 0 -- Inicial
**Done/Total:** 0/5 itens

## Contexto

Implements the golden path: `POST /api/proj/projetos`. Also backs the in-process
`CreateProjetoEditorialUseCase` port exported for IMP's create-and-upload flow (D-C).
Creates a `ProjetoEditorial` in `rascunho`, appends the initial `projeto_status_historico`
row (`status_de=NULL, status_para=rascunho, solicitado_por=editor`), and emits `ProjectCreated`
**after commit**. `editoraId` is resolved from `EmpresaContext`, never from the request body.

## Spec de referencia
- SPEC-01 (api-contract.md §4.1, §6.1)
- SPEC-05 (idempotency — unique eventId per ProjectCreated)
- integration-contracts.md §1.1

## Escopo

Files to create (relative to monolith root `backend/`):

- [ ] `src/modules/proj/use-cases/create-projeto-editorial.use-case.ts` — validates `nome` (non-empty, ≤200), resolves `editoraId` from `EmpresaContext`, persists via `ProjetoEditorialRepository`, appends `projeto_status_historico` in same transaction, emits `ProjectCreated` (post-commit hook via NestJS EventEmitter)
- [ ] `src/modules/proj/use-cases/create-projeto-editorial.use-case.spec.ts` — unit tests: valid nome creates + emits; empty nome throws `ValidationError`; `editoraId` resolved from context, not body
- [ ] `src/domain/proj/events/project-created.event.ts` — payload: `{ eventId, occurredAt, projetoId, editoraId, nome, status: 'rascunho' }`
- [ ] `src/modules/proj/proj.controller.ts` — wire `POST /projetos` to use case (update PROJ-001 stub), return 201 with `ProjetoDetail`, `Location` header

## Criterios de aceite

- [ ] Valid `nome` persists `ProjetoEditorial` with `status=rascunho`, `editoraId` from JWT claim
- [ ] `projeto_status_historico` row appended in same transaction (`status_de=null, status_para=rascunho`)
- [ ] `ProjectCreated` event emitted with unique `eventId` (UUID v4), never on rollback
- [ ] 400 `urn:cordele:proj:validation` when `nome` is missing or empty; nothing persisted
- [x] In-process port `CreateProjetoEditorialUseCase.create({ titulo })` returns `{ projetoId }` for IMP
- [x] `pnpm test` on use case spec exits 0

## Dependencias

- PROJ-001 (precede — ProjModule and controller stubs)
- PROJ-002 (precede — ProjectStatus VO for initial status)
- PROJ-008 (precede — ProjetoEditorialRepository Prisma adapter required for integration)

## Estimativa
M

## Prioridade
P2
