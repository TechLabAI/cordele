# PROJ-014 -- JwtAuthGuard + EmpresaContext tenant injection + scope guards (proj:read, proj:write, proj:delete)

**Status:** REDUCED -- pos-validacao 2026-08-28
**Maturidade:** 56 -- Parcial
**Done/Total:** 2/10 itens

## Contexto

Secures all PROJ endpoints with OAuth2 Bearer JWT validation and per-endpoint scope guards
(SPEC-06). `EmpresaContext` (AsyncLocalStorage) is populated from the JWT `empresa` claim —
**never** from path, query, or body (api-contract §2). Every use case resolves the active
empresa solely from `EmpresaContext`, making it impossible for callers to scope-jump.

Scopes required per endpoint (api-contract §2):
- `proj:read` — `GET /projetos`, `GET /projetos/{id}`, `GET /projetos/{id}/publicacoes`, download URL
- `proj:write` — `POST /projetos`, `POST /projetos/{id}/reopen`
- `proj:delete` — `DELETE /projetos/{id}` (privileged LGPD scope)

## Spec de referencia
- SPEC-06 (security — OAuth2, scopes, tenant claim)
- api-contract.md §2 (auth, tenancy)
- ADR-003-multi-tenancy.md (RULE-07)

## Escopo

Files to create (relative to monolith root `backend/`):

- [ ] `src/infrastructure/auth/jwt.guard.ts` — validates JWT from `Authorization: Bearer`; on invalid/missing token throws 401; populates `EmpresaContext` (slug + editoraId) from JWT claims; if the module does not already share a monolith-wide guard, reference the shared guard and annotate with `PROJ` scope binding
- [ ] `src/infrastructure/auth/scopes.decorator.ts` + `src/infrastructure/auth/scopes.guard.ts` — `@Scopes('proj:read')` decorator + guard reads required scopes from metadata and validates against JWT `scope` claim
- [ ] `src/infrastructure/context/empresa.context.ts` — `AsyncLocalStorage<EmpresaContext>` singleton; `EmpresaContext.getEditoraId()`, `EmpresaContext.getSlug()`, `EmpresaContext.run(store, fn)` for middleware wrapping
- [ ] `src/modules/proj/proj.controller.ts` — apply `@UseGuards(JwtAuthGuard, ScopesGuard)` + `@Scopes(...)` on each route (update PROJ-001 deliverable)
- [ ] `src/modules/proj/proj.controller.spec.ts` — add 401/403 cases for missing/invalid token and wrong scope

## Criterios de aceite

- [ ] Request without `Authorization` header returns 401 `urn:cordele:proj:unauthorized`
- [ ] Request with valid JWT but missing `proj:delete` scope returns 403 `urn:cordele:proj:forbidden` on `DELETE /projetos/{id}`
- [ ] `EmpresaContext.getEditoraId()` returns the empresaId from the JWT claim, not from request body/path
- [ ] All PROJ endpoints unreachable without a valid JWT (integration test via supertest)
- [ ] `pnpm test` on controller spec exits 0

## Dependencias

- PROJ-001 (precede — ProjController must exist before guards are applied)
- PROJ-008 (precede — EmpresaContext consumed by repository)

## Estimativa
M

## Prioridade
P5
