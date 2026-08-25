# PROJ-004 -- AdvanceProjetoStatusUseCase.advanceTo idempotent with audit append and ProjectStatusChanged

**Status:** INTACT -- gerado 2026-08-25
**Maturidade:** 0 -- Inicial
**Done/Total:** 0/5 itens

## Contexto

Implements the inbound port `AdvanceProjetoStatusUseCase.advanceTo({ projetoId, targetStatus })`,
the **only** mechanism by which IMP (`rascunho → em_composicao` on confirm-estrutura) and PUB
(`em_composicao → publicado|com_erros`) advance project status (ADR-002 / D-D).

Rules: delegates to `ProjectStatus.advanceTo` VO; applies the change + appends
`projeto_status_historico` + emits `ProjectStatusChanged` **only on an actual change**;
idempotent no-op returns `{ changed: false }` without emitting an event or writing history.

This use case is both a REST-less in-process port (called by IMP/PUB) and — indirectly — the
engine behind the status lifecycle described in api-contract §7.

## Spec de referencia
- SPEC-02 (advance transitions + idempotency + audit)
- SPEC-05 (concurrent advanceTo, unique eventId)
- integration-contracts.md §1.3

## Escopo

Files to create (relative to monolith root `backend/`):

- [ ] `src/modules/proj/use-cases/advance-projeto-status.use-case.ts` — loads `ProjetoEditorial` within caller's `EmpresaContext`, delegates to `ProjectStatus.advanceTo`, on actual change: updates row + appends `projeto_status_historico` (same transaction) + emits `ProjectStatusChanged`; on no-op: returns `{ changed: false }` immediately
- [ ] `src/modules/proj/use-cases/advance-projeto-status.use-case.spec.ts` — legal transition applies + emits; idempotent no-op returns `changed=false` without event; illegal transition surfaces `IllegalStatusTransitionError`; concurrent calls on same project are safe (Prisma optimistic lock or serializable read)
- [ ] `src/domain/proj/events/project-status-changed.event.ts` — payload: `{ eventId, occurredAt, projetoId, editoraId, statusDe, statusPara, solicitadoPor }`

## Criterios de aceite

- [ ] Legal transition applies status, appends `projeto_status_historico` row in same DB transaction
- [ ] `ProjectStatusChanged` emitted with unique `eventId`; NOT emitted on idempotent no-op
- [ ] `advanceTo(em_composicao, em_composicao)` returns `{ changed: false }` — IMP idempotency (SPEC-02)
- [ ] `advanceTo(rascunho, publicado)` throws `IllegalStatusTransitionError`
- [ ] Concurrent `advanceTo` for same `projetoId` serializes safely (no double-emit)
- [ ] `pnpm test` on use case spec exits 0

## Dependencias

- PROJ-002 (precede — ProjectStatus VO with transition table)
- PROJ-007 (precede — Prisma schema with ProjetoStatusHistorico)
- PROJ-008 (precede — ProjetoEditorialRepository)

## Estimativa
M

## Prioridade
P2
