# COMP-019 -- Health endpoint (Prisma readiness + FileStoragePort) + metrics counters

**Status:** INTACT -- gerado 2026-08-25
**Maturidade:** 0 -- Inicial
**Done/Total:** 0/4 itens

## Contexto

Adds the readiness health check and the operation counters declared in SPEC-07. The health
check endpoint (`GET /api/comp/health`) verifies the Prisma DB connection and the
`FileStoragePort` storage availability (cover directory writable for disk adapter). The
`FileStoragePort` check is degradable — if storage is unavailable, COMP marks itself degraded
for cover uploads but the rest of the module remains healthy (metadata/layout still readable
and writable). Counters track: `metadata_upsert` (total, errors), `cover_upload`
(total, 413/415 rejections), `layout_upsert` (total, 422 rejections), `preview_context`
(total, stale-override count). This is a separate task from COMP-018 correlation middleware,
as specified in M3 warnings (infra tasks separated from request middleware).

## Spec de referencia
- SPEC-07 (observability — health endpoint, FileStoragePort degradability, counters for each operation)

## Escopo

Files to create (relative to monolith root `backend/`):

- [ ] `src/modules/comp/comp.controller.ts` (amend) — add `GET /health` route; calls `CompHealthService.check()`; returns `{ status: 'ok'|'degraded', checks: { db: 'ok'|'fail', storage: 'ok'|'degraded' } }`
- [ ] `src/modules/comp/infrastructure/comp-health.service.ts` — `check()`: `prisma.$queryRaw('SELECT 1')` for DB; `FileStoragePort.put('healthcheck', ...)` followed by `delete` (or write probe to disk dir) for storage; catches errors per check; DB failure = `status: fail`; storage failure = `status: degraded`
- [ ] `src/infrastructure/comp/metrics/comp-metrics.service.ts` — in-process counters (Map<string, number>); `increment(metric: string, labels?: Record<string, string>)`: thread-safe increment; `getSnapshot()`: returns current counts; metrics: `comp_metadata_upsert_total`, `comp_cover_upload_total`, `comp_cover_rejection_total` (by `reason: 413|415`), `comp_layout_upsert_total`, `comp_layout_rejection_total` (by `reason: 422`), `comp_preview_context_total`, `comp_preview_stale_overrides_total`
- [ ] `src/infrastructure/comp/metrics/comp-metrics.service.spec.ts` — increment and snapshot; label grouping

## Criterios de aceite

- [ ] `GET /api/comp/health` with healthy DB and storage → `{ status: 'ok' }` 200
- [ ] `GET /api/comp/health` with storage unavailable → `{ status: 'degraded', checks: { storage: 'degraded' } }` 200 (not 503 — metadata/layout still ok)
- [ ] `GET /api/comp/health` with DB unavailable → `{ status: 'fail' }` 503
- [ ] Cover upload rejection increments `comp_cover_rejection_total` with correct `reason` label
- [ ] `pnpm test` on metrics service spec exits 0

## Dependencias

- COMP-001 (precede — CompController exists to add health route)
- COMP-015 (precede — FileStoragePort disk adapter exists for storage probe)
- COMP-004 (precede — use cases exist so metrics counters can be injected)

## Estimativa
M

## Prioridade
P7
