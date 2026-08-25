# COMP-004 -- UpdateMetadadosUseCase (upsert idempotente) + GetMetadadosViewUseCase

**Status:** INTACT -- gerado 2026-08-25
**Maturidade:** 0 -- Inicial
**Done/Total:** 0/5 itens

## Contexto

Implements the two metadata use cases driving `PUT /api/comp/projetos/:id/metadados` and
`GET /api/comp/projetos/:id/metadados`. The upsert is keyed by `projetoId` (UNIQUE constraint);
re-sending an identical body is a no-op returning the current representation (idempotent, SPEC-05).
`UpdateMetadadosUseCase` emits `MetadataUpdated` **post-commit** (in-process event, no broker).
`GetMetadadosViewUseCase` returns `materialized=false` default when the aggregate does not yet
exist (D-M lazy default — never 404 on a GET). Neither use case writes `projeto_editorial`
or changes project status (ADR-002 boundary).

**Concurrency note (SPEC-05.C5):** concurrent writes on the same `projetoId` serialize at
the `UNIQUE(projeto_id)` row in the DB — no explicit application-level lock is needed.

## Spec de referencia
- SPEC-02 (metadata configuration — upsert, lazy default, MetadataUpdated)
- SPEC-05 (idempotency — no-op on identical re-send, lazy materialization)
- SPEC-01 (api-surface — `comp:read`/`comp:write`, never writes projeto_editorial)

## Escopo

Files to create (relative to monolith root `backend/`):

- [ ] `src/modules/comp/application/update-metadados.use-case.ts` — `execute({ projetoId, titulo, autor, isbn?, idioma, categoria? })`: load or create `Metadados` via `MetadadosRepository`; call `aggregate.update(fields)`; persist; emit `MetadataUpdated` post-commit; return current representation; no-op if body identical (detected by aggregate equals)
- [ ] `src/modules/comp/application/get-metadados-view.use-case.ts` — `execute({ projetoId })`: load from repository; if absent, return `Metadados.createDefault(projetoId)` (no persist); never 404
- [ ] `src/modules/comp/ports/metadados-repository.port.ts` — interface `MetadadosRepository` with `findByProjetoId(id): Promise<Metadados | null>` and `upsert(m: Metadados): Promise<Metadados>`
- [ ] `src/modules/comp/application/update-metadados.use-case.spec.ts` — mock repository: upsert persists; identical body → no second persist call; blank titulo → DomainException propagated → 400 at controller
- [ ] `src/modules/comp/application/get-metadados-view.use-case.spec.ts` — absent row → returns default; present row → returns persisted

## Criterios de aceite

- [ ] Re-sending identical PUT body makes 1 total repository write (no-op detected before second write)
- [ ] GET before any PUT returns `{ materialized: false }` (no DB write)
- [ ] `MetadataUpdated` emitted exactly once per successful mutating PUT
- [ ] DomainException from aggregate propagates and is mapped to 400 by the exception filter
- [ ] `pnpm test` on both use case specs exits 0

## Dependencias

- COMP-003 (precede — Metadados aggregate must exist)
- COMP-001 (precede — DI token `UPDATE_METADADOS_USE_CASE` / `GET_METADADOS_USE_CASE` declared)

## Estimativa
M

## Prioridade
P2
