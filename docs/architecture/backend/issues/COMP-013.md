# COMP-013 -- JWT OAuth2 guard + scope-check per route (comp:read / comp:write)

**Status:** INTACT -- gerado 2026-08-25
**Maturidade:** 0 -- Inicial
**Done/Total:** 0/5 itens

## Contexto

Implements the NestJS JWT auth guard and per-route scope-check guards for all 7 COMP REST
routes. This is a priority security concern highlighted in M3 warnings (SPEC-06.C2 / SPEC-01.C3).
The JWT is validated against `OAUTH2_JWK_SET_URI`; the `empresa` claim populates
`EmpresaContext`; `projetoId` of another empresa responds 404 (never reveals cross-tenant
existence). Read routes (`GET metadados`, `GET layout`, `GET preview-context`) require
`comp:read`; write routes (`PUT metadados`, `POST capa`, `DELETE capa`, `PUT layout`) require
`comp:write`. Unauthenticated → 401; authenticated but missing scope → 403.

## Spec de referencia
- SPEC-06 (security — JWT, scopes comp:read/comp:write, tenant from claim, 401/403/404)
- SPEC-01 (api-surface — scope per route table)

## Escopo

Files to create (relative to monolith root `backend/`):

- [x] `src/infrastructure/comp/auth/jwt-auth.guard.ts` — NestJS `CanActivate` implementing JWT validation via `OAUTH2_JWK_SET_URI` (RS256); extracts `empresa` claim e `principalId`; populates `EmpresaContext`; 401 if no/invalid token
- [x] `src/infrastructure/comp/auth/scope.guard.ts` — `ScopeGuard` factory decorator: checks `scopes` metadata on route; 403 if token lacks required scope; reuses PROJ's scope guard pattern if already present in monolith
- [x] `src/modules/comp/comp.controller.ts` (amend from COMP-001) — apply `@UseGuards(JwtAuthGuard, ScopeGuard)` + `@RequiredScopes('comp:read'|'comp:write')` per route; replace stub allow-all guards from P1
- [x] `src/infrastructure/comp/auth/jwt-auth.guard.spec.ts` — missing token → 401; expired token → 401; valid token → empresa claim in EmpresaContext; unknown empresa → 404 at use case (not at guard)
- [x] `src/infrastructure/comp/auth/scope.guard.spec.ts` — token with `comp:read` on read route → passes; same token on write route → 403; token with `comp:write` on any route → passes

## Criterios de aceite

- [x] `GET /api/comp/projetos/:id/metadados` with no token → 401
- [x] `PUT /api/comp/projetos/:id/metadados` with `comp:read` scope only → 403
- [x] `PUT /api/comp/projetos/:id/metadados` with valid `comp:write` token → reaches use case (200/400)
- [x] `EmpresaContext` populated from JWT claim before any use case or repository call
- [x] `pnpm test` on both guard specs exits 0

## Dependencias

- COMP-001 (precede — CompController route declarations)
- COMP-004 (precede — use cases wired; guards need them present to test full path)

## Estimativa
M

## Prioridade
P5
