# PROJ-002 -- ProjectStatus value object with legal-transition table and invariants

**Status:** INTACT -- gerado 2026-08-25
**Maturidade:** 0 -- Inicial
**Done/Total:** 0/5 itens

## Contexto

The `ProjectStatus` value object encodes the **entire legal-transition table** from api-contract §7.
No controller, use case, or adapter re-encodes transition rules — they all delegate to this VO.
`advanceTo(current, target)` is the forward/idempotent path for IMP and PUB; `reopen(current)` is
the single deliberate backward edge. Illegal transitions throw `IllegalStatusTransitionError`.

This VO is the domain invariant that makes ADR-002 (single status authority) mechanically enforceable.

## Spec de referencia
- SPEC-02 (project-lifecycle-status-authority) — full transition table + idempotency rules
- api-contract.md §7

## Escopo

Files to create (relative to monolith root `backend/`):

- [ ] `src/domain/proj/value-objects/project-status.vo.ts` — enum `ProjetoStatus { rascunho, em_composicao, publicado, com_erros }`; static `advanceTo(current, target): { newStatus, changed }` (validates legal table, idempotent no-op returns `changed=false`); static `reopen(current): { newStatus, changed }` (validates `publicado|com_erros → em_composicao`, idempotent on `em_composicao`, rejects `rascunho`); throws `IllegalStatusTransitionError` on illegal transitions
- [ ] `src/domain/proj/errors/illegal-status-transition.error.ts` — extends `DomainError`; carries `from`, `to`, `reason`
- [ ] `src/domain/proj/value-objects/project-status.vo.spec.ts` — unit tests for every edge in the legal table (7 forward/lateral transitions + 2 reopen edges + all rejection cases + idempotent no-ops)

## Criterios de aceite

- [ ] All 7 legal transitions in api-contract §7 pass without throwing
- [ ] `advanceTo` with `targetStatus === currentStatus` returns `changed=false` without throwing
- [ ] `advanceTo(em_composicao, em_composicao)` returns `changed=false` (IMP idempotency rule)
- [ ] `advanceTo(rascunho, publicado)` throws `IllegalStatusTransitionError`
- [ ] `reopen(rascunho)` throws `IllegalStatusTransitionError`
- [ ] `reopen(publicado)` returns `{ newStatus: em_composicao, changed: true }`
- [ ] `pnpm test src/domain/proj/value-objects/project-status.vo.spec.ts` exits 0

## Dependencias

- PROJ-001 (precede — domain layer must compile inside the module context)

## Estimativa
S

## Prioridade
P2
