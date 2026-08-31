# PROJ-016 -- DeleteProjetoEditorialUseCase leaf-first LGPD erasure orchestration (idempotent, abort-before-identity, 502 on failure)

**Status:** REDUCED -- pos-validacao 2026-08-28
**Maturidade:** 72 -- Consistente
**Done/Total:** 4/10 itens

## Contexto

Implements `DELETE /api/proj/projetos/{projetoId}` (D-G). Runs an **in-process, leaf-first,
idempotent purge** across PUB, COMP, and IMP (rows + binaries) before deleting the
`projeto_editorial` identity row. Emits `ProjectDeleted` after commit.

Purge order (api-contract §4.6):
1. `PublicationErasurePort.purge(projetoId)` — PUB rows + ePub/PDF artifacts
2. `CompositionErasurePort.purge(projetoId)` — COMP rows
3. `ManuscriptErasurePort.purge(projetoId)` — IMP rows + binaries/images
4. Delete `projeto_editorial` (cascade-deletes `projeto_status_historico`)

Failure semantics: if **any per-context purge step throws**, the use case **aborts before step 4**
(identity row is NOT deleted), returns 502 `urn:cordele:proj:erasure-failed`, and leaves the
project recoverable. DB `ON DELETE CASCADE` is the backstop, not the erasure mechanism (SPEC-11).

Each step is idempotent — a partial failure can be retried safely.

## Spec de referencia
- SPEC-11 (cross-context-deletion-lgpd-erasure — full order, idempotency, failure semantics)
- api-contract.md §4.6, §5

## Escopo

Files to create (relative to monolith root `backend/`):

- [ ] `src/modules/proj/use-cases/delete-projeto.use-case.ts` — validates projetoId exists in active empresa (404 otherwise); calls purge ports in order 1→3; on any port failure: catches error, throws `BadGatewayException` (no identity deletion); on all ports OK: deletes `projeto_editorial` row via repository; emits `ProjectDeleted` after commit
- [ ] `BadGatewayException` used instead of a custom error — carries type `urn:cordele:proj:erasure-failed` + `port` field indicating which erasure port failed
- [ ] `src/domain/proj/events/project-deleted.event.ts` — payload: `{ eventId, occurredAt, projetoId, editoraId }`
- [ ] `src/modules/proj/use-cases/delete-projeto.use-case.spec.ts` — full purge success → 204, `ProjectDeleted` emitted; PUB purge fails → 502, `projeto_editorial` NOT deleted, no event; IMP purge fails → 502, same; idempotent retry succeeds when all stubs are no-ops; unknown projetoId → 404
- [ ] `src/modules/proj/proj.controller.ts` — wire `DELETE /projetos/:projetoId` (update PROJ-001 stub); map `ErasureFailedError` → 502; return 204 on success

## Criterios de aceite

- [ ] Full purge: 204 returned; `projeto_editorial` row deleted; `ProjectDeleted` emitted
- [ ] PUB purge failure: 502 `urn:cordele:proj:erasure-failed`; `projeto_editorial` row still exists (verified in spec by repository mock assertion)
- [ ] Each purge step called exactly once per request in order: PUB → COMP → IMP → DB delete (verified by mock call order assertion in spec)
- [ ] Retried deletion (stubs return no-op on missing data) completes without error (idempotent)
- [ ] `pnpm test` on use case spec exits 0

## Dependencias

- PROJ-008 (precede — ProjetoEditorialRepository.delete)
- PROJ-015 (precede — erasure port stubs)

## Estimativa
L

## Prioridade
P6
