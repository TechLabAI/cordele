# COMP-008 -- GetLayoutPreviewUseCase (preview-context assembly via ManuscriptContentPort)

**Status:** INTACT -- gerado 2026-08-25
**Maturidade:** 0 -- Inicial
**Done/Total:** 0/4 itens

## Contexto

Implements `GET /api/comp/projetos/:id/preview-context`. The response is **data, not pixels**
(D-K): the content tree from IMP (read-only via `ManuscriptContentPort`), the persisted layout,
and the non-stale overrides. The client (SPA T06) renders the preview client-side; nothing
rendered is stored. If the project has no imported manuscript (`getContentTree` returns `null`),
the endpoint responds 409 (`urn:cordele:comp:manuscript-missing`). Overrides whose `referenciaNo`
no longer resolves in the current tree are marked `stale=true` and excluded from the honoured
set (R2/G4). If `ManuscriptContentPort` is unavailable, the endpoint fails explicitly with a
non-500 error — metadata and layout remain usable (SPEC-07 degradation rule).

## Spec de referencia
- SPEC-03 (preview — data not pixels, stale override detection, manuscript-missing 409)
- SPEC-07 (observability — degradation: IMP unavailable → explicit error, not silent 500)
- `contracts/api-contract.md` §4.7, §6.4 (preview-context response shape)
- `contracts/integration-contracts.md` §2.1 (ManuscriptContentPort signatures)

## Escopo

Files to create (relative to monolith root `backend/`):

- [ ] `src/modules/comp/application/get-layout-preview.use-case.ts` — `execute({ projetoId })`: call `ManuscriptContentPort.getContentTree(projetoId)`; if null → 409 (`manuscript-missing`); load `ConfiguracaoLayout` (default if absent); for each override, check `nodeExists(projetoId, referenciaNo)` and mark `stale=true` if false; compose `PreviewContext` with tree + layout + only non-stale overrides; return 200
- [ ] `src/modules/comp/application/get-layout-preview.use-case.spec.ts` — no manuscript → 409; stale override excluded from honoured set; stale=true on response object; ManuscriptContentPort throws → explicit error propagated; valid path → all data assembled
- [ ] `src/modules/comp/dto/preview-context-response.dto.ts` — response shape matching api-contract §6.4: `{ estrutura, layout, overrides[{ referenciaNo, alinhamento, ordem, stale }] }`

## Criterios de aceite

- [ ] `getContentTree` returning null → 409 `urn:cordele:comp:manuscript-missing`
- [ ] Override with stale `referenciaNo` appears in response with `stale=true` and is excluded from honoured set
- [ ] `ManuscriptContentPort` throwing → 503/409 explicit error; metadata endpoint remains unaffected
- [ ] Response shape matches api-contract §6.4 exactly
- [ ] `pnpm test` on the use case spec exits 0

## Dependencias

- COMP-006 (precede — ConfiguracaoLayout aggregate)
- COMP-007 (precede — ManuscriptContentPort interface declared)
- COMP-001 (precede — DI token `GET_LAYOUT_PREVIEW_USE_CASE` declared)

## Estimativa
M

## Prioridade
P2
