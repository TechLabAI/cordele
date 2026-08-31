# PROJ-017 -- Health endpoint (@nestjs/terminus) + correlation ID propagation + degraded:true structured logging

**Status:** REDUCED -- pos-validacao 2026-08-28
**Maturidade:** 69 -- Consistente
**Done/Total:** 2/7 itens

## Contexto

Operational readiness for PROJ: health endpoint, correlation ID middleware, and structured
logging for the `degraded:true` signal emitted by the read port stubs (PROJ-009) and real adapters
(PROJ-INT-001..003).

`X-Correlation-Id` is accepted from incoming requests or generated (UUID v4) if absent, propagated
to all outbound port calls (in-process: passed as context), and always returned in the response
header (api-contract §3, SPEC-07 cls 3). When `degraded=true` is encountered in a use case,
the structured logger emits `WARN` with field `port=<PortName>` for observability (SPEC-07 cls 5).

## Spec de referencia
- SPEC-07 (observability-health — health, correlation ID, degraded logging)
- api-contract.md §3 (required headers)

## Escopo

Files to create (relative to monolith root `backend/`):

- [ ] `src/infrastructure/health/health.controller.ts` — `GET /api/proj/health` (or shared monolith health endpoint if already registered); uses `@nestjs/terminus` `HealthCheckService` + `PrismaHealthIndicator`; returns 200 `{ status: 'ok' }` or 503 on DB unavailability
- [ ] `src/infrastructure/http/correlation-id.interceptor.ts` — NestJS interceptor: reads `X-Correlation-Id` from request or generates UUID v4; stores in `AsyncLocalStorage<{ correlationId }>`; sets response header `X-Correlation-Id`; applies to all routes in `ProjModule`
- [ ] Logger configuration (if not already shared) — structured JSON logger with fields: `correlationId`, `port` (when `degraded:true`), `level` (`WARN` on degraded), `module: 'proj'`

## Criterios de aceite

- [ ] `GET /api/proj/health` returns 200 `{ status: 'ok' }` when DB reachable
- [ ] Every response includes `X-Correlation-Id` header matching the request header (or a new UUID if absent)
- [ ] When `ManuscriptSummaryPort` stub emits `degraded:true`, a `WARN` log entry contains `port=ManuscriptSummaryPort` and `correlationId` (verifiable via logger spy in integration test)
- [ ] `pnpm build` exits 0 with health controller registered

## Dependencias

- PROJ-001 (precede — ProjModule for middleware registration)
- PROJ-007 (precede — Prisma client for health indicator)

## Estimativa
S

## Prioridade
P7
