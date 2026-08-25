# COMP-018 -- Correlation middleware (X-Correlation-Id echo + EmpresaContext propagation) + structured logging

**Status:** INTACT -- gerado 2026-08-25
**Maturidade:** 0 -- Inicial
**Done/Total:** 0/4 itens

## Contexto

Implements the cross-cutting observability middleware for COMP: every request reads or generates
`X-Correlation-Id`, echoes it on the response, and carries it into `EmpresaContext`
(alongside `empresa`/`principalId`) so that logs and in-process events all share the same
correlation id (SPEC-07). Structured JSON logging emits `correlationId`, `empresa`, `projetoId`
(extracted from path), `route`, `statusCode`, and `durationMs` per request. Errors are mapped
to RFC 7807 `application/problem+json` with `traceId = X-Correlation-Id`.

## Spec de referencia
- SPEC-07 (observability — X-Correlation-Id propagation, EmpresaContext, RFC 7807 errors)

## Escopo

Files to create (relative to monolith root `backend/`):

- [ ] `src/infrastructure/comp/middleware/correlation.middleware.ts` — NestJS `NestMiddleware`: reads `X-Correlation-Id` from request header or generates UUID v4; sets in `EmpresaContext` as `correlationId`; echoes on response header `X-Correlation-Id`
- [ ] `src/infrastructure/comp/middleware/request-logger.middleware.ts` — logs JSON `{ correlationId, empresa, projetoId, route, method, statusCode, durationMs }` on response finish; uses the monolith's shared logger (Winston or Pino)
- [ ] `src/infrastructure/comp/filters/problem-json.filter.ts` — NestJS `ExceptionFilter`: maps `DomainException` → 400; `NotFoundException` → 404; `UnauthorizedException` → 401; `ForbiddenException` → 403; all with `application/problem+json` body `{ type, title, status, traceId }`
- [ ] `src/modules/comp/comp.module.ts` (amend) — apply both middlewares to all COMP routes; register `ProblemJsonFilter` globally for the comp context

## Criterios de aceite

- [ ] Request without `X-Correlation-Id` header → response contains generated UUID in `X-Correlation-Id` header
- [ ] Request with `X-Correlation-Id: abc-123` → response echoes `X-Correlation-Id: abc-123`
- [ ] `DomainException` from use case → 400 `application/problem+json` with `traceId` matching request `X-Correlation-Id`
- [ ] `pnpm test` runs middleware unit tests and exits 0

## Dependencias

- COMP-001 (precede — CompModule exists to apply middleware to)
- COMP-013 (precede — JWT guard populates EmpresaContext before middleware reads it; ordering must be correct)

## Estimativa
S

## Prioridade
P7
