# PROJ-008 -- ProjetoEditorialRepository Prisma adapter (schema-per-tenant via EmpresaContext)

**Status:** NEAR-CLOSED -- pos-validacao 2026-08-28
**Maturidade:** 83 -- Maduro
**Done/Total:** 7/9 itens

## Contexto

Infrastructure adapter that implements the `ProjetoEditorialRepositoryPort` using Prisma targeting
the tenant schema resolved from `EmpresaContext` (RULE-07 / ADR-003 multi-tenancy). All queries
are scoped by `editoraId` from the active context — cross-tenant data is never accessible.

This adapter is the single point where all PROJ use cases touch the database. Status mutations
(PROJ-003..005) must use a Prisma transaction that also appends `projeto_status_historico` in
the same commit.

## Spec de referencia
- SPEC-04 (data model, schema-per-tenant)
- SPEC-05 (idempotency via Prisma transaction isolation)
- data-model.md §5 (data lifecycle)

## Escopo

Files to create (relative to monolith root `backend/`):

- [x] `src/domain/proj/ports/outbound/projeto-editorial-repository.port.ts` — interface: `create(data): Promise<ProjetoEditorialData>`, `findById(id, empresaId): Promise<ProjetoEditorialData | null>`, `findAll(empresaId, filter?): Promise<ProjetoEditorialData[]>`, `updateStatus(input): Promise<ProjetoEditorialData>` (transactional), `delete(id, empresaId): Promise<void>`, `existsByIdAndEmpresa(id, empresaId): Promise<boolean>`
- [x] `src/infrastructure/persistence/proj/projeto-editorial.repository.ts` — Prisma adapter; resolves tenant schema slug via TenantPrismaFactory.withTenant(empresaId); `updateStatus` is a Prisma `$transaction` updating the row + inserting `projeto_status_historico`
- [x] `src/infrastructure/persistence/proj/projeto-editorial.repository.spec.ts` — unit tests with Prisma mock: create (inserts both rows), findById (own empresa), findById (other empresa returns null), updateStatus writes both rows in transaction

## Criterios de aceite

- [x] `findById` returns `null` for a project belonging to a different empresa (cross-tenant isolation — unit test verifies withTenant called with correct empresaId)
- [x] `findAll` returns projects ordered by `atualizado_em DESC` (index `idx_projeto_editorial_atualizado_em`)
- [x] `updateStatus` writes the `projeto_editorial` update and `projeto_status_historico` insert in a single Prisma `$transaction`
- [x] Tenant schema slug resolved from `TenantPrismaFactory.withTenant(empresaId)`, never a hardcoded schema name
- [x] `pnpm test` on repository spec exits 0 (validado pelo Validator-Orchestrator com DB real)
- [x] proj.module.ts stub `{ provide: PROJETO_EDITORIAL_REPOSITORY, useValue: {...} }` removed — confirmed: DONE (moved to PersistenceModule with real adapter)

## Dependencias

- PROJ-007 (precede — Prisma schema and migrations must exist)
- PROJ-014 (security, provides EmpresaContext — required for integration tests)

## Estimativa
M

## Prioridade
P3
