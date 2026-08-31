# COMP-014 -- ManuscriptContentPort stub adapter (fixture tree + nodeExists=true for pre-IMP scaffold)
<!-- status: in-review -->

**Status:** INTACT -- gerado 2026-08-25
**Maturidade:** 0 -- Inicial
**Done/Total:** 0/3 itens

## Contexto

Provides a thin stub implementation of `ManuscriptContentPort` (interface declared in COMP-007)
so that COMP compiles and the preview/override paths exercise before IMP's in-process content
query port exists. The stub returns a small fixture content tree with known `referenciaNo` values
for `getContentTree` and always returns `true` for `nodeExists`. This unblocks BDD tests (COMP-020)
and integration testing without requiring IMP to be scaffolded first. The real adapter is in
INT-COMP-001 and replaces this stub once IMP exports its query port.

## Spec de referencia
- SPEC-10 (integrations — ManuscriptContentPort stub note; scaffold note)
- `contracts/integration-contracts.md` §2.1 (ManuscriptContentPort signatures)

## Escopo

Files to create (relative to monolith root `backend/`):

- [x] `src/infrastructure/comp/manuscript/manuscript-content-stub.adapter.ts` — implements `ManuscriptContentPort`; `getContentTree(projetoId)` returns a fixture tree (`{ manuscritoId: 'fixture-id', estrutura: [{ id: 'img-1', tipo: 'imagem' }, { id: 'p-1', tipo: 'paragrafo' }] }`) or `null` for a known "no-manuscript" project id (configurable via env `COMP_STUB_NO_MANUSCRIPT_IDS`); `nodeExists` returns `true` for any `referenciaNo` not in a configured denial list
- [x] `src/modules/comp/comp.module.ts` (amend) — register stub under `MANUSCRIPT_CONTENT_PORT` token when `NODE_ENV !== 'production'` OR when `COMP_USE_STUB_MANUSCRIPT=true`
- [x] `src/infrastructure/comp/manuscript/manuscript-content-stub.adapter.spec.ts` — configured no-manuscript id → `getContentTree` returns null; any other → returns fixture tree; `nodeExists` returns true by default

## Criterios de aceite

- [x] `GET /api/comp/projetos/fixture-id/preview-context` returns 200 with fixture tree (stub active)
- [x] Project id in denial list → `getContentTree` returns null → 409 `manuscript-missing`
- [ ] `nodeExists` returns true for any `referenciaNo` not in denial list
- [x] `pnpm test` on stub spec exits 0

## Dependencias

- COMP-007 (precede — `ManuscriptContentPort` interface declared)
- COMP-008 (precede — `GetLayoutPreviewUseCase` uses the port)

## Estimativa
S

## Prioridade
P4
