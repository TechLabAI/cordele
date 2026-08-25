# PROJ-005 -- ReopenProjectForRevisionUseCase + POST /projetos/{id}/reopen handler

**Status:** INTACT -- gerado 2026-08-25
**Maturidade:** 0 -- Inicial
**Done/Total:** 0/4 itens

## Contexto

Implements the inbound port `ReopenProjectForRevisionUseCase.reopen({ projetoId })`, the **one**
deliberate backward edge in the status lifecycle (G6 / D-D). The editor triggers this via
`POST /api/proj/projetos/{projetoId}/reopen` (T08 "Ajustar metadados/layout" button).

Rules: `publicado|com_erros → em_composicao`; idempotent no-op if already `em_composicao`;
rejects from `rascunho` with 409. Delegates to `ProjectStatus.reopen` VO. Emits
`ProjectStatusChanged` only on an actual change.

This is explicitly separated from `advanceTo` so the backward edge is auditable and only
triggerable by a human action — not by IMP or PUB (ADR-002).

## Spec de referencia
- SPEC-02 (reopen as sole backward edge + idempotency)
- api-contract.md §4.7, §7
- integration-contracts.md §1.4

## Escopo

Files to create (relative to monolith root `backend/`):

- [ ] `src/modules/proj/use-cases/reopen-project-for-revision.use-case.ts` — loads project within `EmpresaContext`, delegates to `ProjectStatus.reopen`, on change: updates row + appends `projeto_status_historico (solicitado_por=editor)` + emits `ProjectStatusChanged`; on no-op returns `{ changed: false }`; on `rascunho` throws `IllegalStatusTransitionError`
- [ ] `src/modules/proj/use-cases/reopen-project-for-revision.use-case.spec.ts` — reopen from `publicado` succeeds; idempotent on `em_composicao`; rejects from `rascunho`
- [ ] `src/modules/proj/proj.controller.ts` — wire `POST /projetos/:projetoId/reopen` to use case (update PROJ-001 stub); on success return `200` with `ProjetoDetail`; map `IllegalStatusTransitionError` → 409

## Criterios de aceite

- [ ] `POST /projetos/{id}/reopen` on `publicado` returns 200 with `ProjetoDetail` and `status=em_composicao`
- [ ] Reopen when already `em_composicao` returns 200 with `changed=false` (idempotent, no event)
- [ ] `POST /projetos/{id}/reopen` when `rascunho` returns 409 `urn:cordele:proj:illegal-status-transition`
- [x] `ProjectStatusChanged` emitted with `solicitadoPor=editor` on actual change only
- [x] `pnpm test` on use case spec exits 0

## Dependencias

- PROJ-002 (precede — ProjectStatus VO reopen logic)
- PROJ-004 (precede — pattern reference for status change + audit)
- PROJ-008 (precede — ProjetoEditorialRepository)

## Estimativa
S

## Prioridade
P2
