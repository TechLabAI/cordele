# PROJ-008 -- ProjetoEditorialRepository Prisma adapter (schema-per-tenant via EmpresaContext)

**Status:** INTACT -- gerado 2026-08-25
**Maturidade:** 0 -- Inicial
**Done/Total:** 0/5 itens

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

- [ ] `src/domain/proj/ports/outbound/projeto-editorial-repository.port.ts` — interface: `create(data): Promise<ProjetoEditorial>`, `findById(id): Promise<ProjetoEditorial | null>`, `findAll(filter): Promise<ProjetoEditorial[]>`, `updateStatus(id, newStatus, historico): Promise<void>` (transactional), `delete(id): Promise<void>`, `existsByIdAndEmpresa(id, empresaSlug): Promise<boolean>`
- [ ] `src/infrastructure/persistence/proj/projeto-editorial.repository.ts` — Prisma adapter; resolves tenant schema slug from `EmpresaContext.getSlug()`; all queries filter by `editoraId` (from `EmpresaContext.getEditoraId()`); `updateStatus` is a Prisma `$transaction` updating the row + inserting `projeto_status_historico`
- [ ] `src/infrastructure/persistence/proj/projeto-editorial.repository.spec.ts` — unit tests with Prisma mock: create, findById (own empresa), findById (other empresa returns null), updateStatus writes both rows in transaction

## Criterios de aceite

- [ ] `findById` returns `null` for a project belonging to a different empresa (cross-tenant isolation)
- [ ] `findAll` returns projects ordered by `atualizado_em DESC` (index `idx_projeto_editorial_atualizado_em`)
- [ ] `updateStatus` writes the `projeto_editorial` update and `projeto_status_historico` insert in a single Prisma `$transaction`
- [ ] Tenant schema slug resolved from `EmpresaContext`, never from caller arguments
- [ ] `pnpm test` on repository spec exits 0

## Dependencias

- PROJ-007 (precede — Prisma schema and migrations must exist)
- PROJ-014 (security, provides EmpresaContext — required for integration tests)

## Estimativa
M

## Prioridade
P3
