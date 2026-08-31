# COMP-007 -- UpdateLayoutUseCase (atomic override set replacement + nodeExists validation)

**Status:** INTACT -- gerado 2026-08-25
**Maturidade:** 0 -- Inicial
**Done/Total:** 0/5 itens

## Contexto

Implements `PUT /api/comp/projetos/:id/layout`. The request body is treated as the **complete,
authoritative** override set — the use case replaces all existing overrides atomically in one
transaction (delete-and-insert or upsert-diff) so there is no partial state. Before persisting,
ALL overrides are validated: `tipo=em-branco` is rejected with `422 structural-edit-deferred`
(D-H); each `referenciaNo` is validated via `ManuscriptContentPort.nodeExists` (422 if not
found). The entire set of overrides must pass validation before any row is written. Emits
`LayoutUpdated` post-commit.

**Concurrency note (SPEC-05.C5):** two concurrent `PUT layout` requests on the same project
serialize at the `UNIQUE(projeto_id)` row — no explicit application-level lock needed; the
second request re-validates `nodeExists` against the current tree.

## Spec de referencia
- SPEC-03 (layout overrides — em-branco rejection, nodeExists, atomic set)
- SPEC-05 (idempotency — re-send identical body is no-op; atomic override replacement)
- `contracts/data-model.md` §2.2–§2.3 (layout_override UNIQUE uq_override_no)

## Escopo

Files to create (relative to monolith root `backend/`):

- [ ] `src/modules/comp/application/update-layout.use-case.ts` — `execute({ projetoId, tipografia, overrides[] })`: validate all overrides (tipo=em-branco → 422; `nodeExists` per referenciaNo → 422 if false); load or create `ConfiguracaoLayout` via repository; call `aggregate.update(tipografia, validatedOverrides)`; persist layout + replace override set atomically; emit `LayoutUpdated` post-commit; return 200
- [ ] `src/modules/comp/ports/configuracao-layout-repository.port.ts` — interface with `findByProjetoId(id): Promise<ConfiguracaoLayout | null>` and `upsert(layout: ConfiguracaoLayout): Promise<ConfiguracaoLayout>`
- [ ] `src/modules/comp/ports/manuscript-content.port.ts` — interface `ManuscriptContentPort` with `getContentTree(projetoId): Promise<{ manuscritoId: string; estrutura: ContentNode[] } | null>` and `nodeExists(projetoId: string, referenciaNo: string): Promise<boolean>`
- [ ] `src/modules/comp/application/update-layout.use-case.spec.ts` — override tipo=em-branco → 422; invalid referenciaNo → 422; valid set → persisted atomically; identical re-send → no-op; `LayoutUpdated` emitted once
- [ ] `src/modules/comp/application/get-layout-view.use-case.ts` — `execute({ projetoId })`: load from repository; if absent return `ConfiguracaoLayout.createDefault(projetoId)`; never 404

## Criterios de aceite

- [x] Override `tipo=em-branco` in any position of the set triggers 422 before any DB write
- [ ] Override with `referenciaNo` returning `nodeExists=false` triggers 422; no rows written — decisao de design divergente e intencional: o override e marcado `stale=true` e a escrita prossegue (200), em vez de rejeitar com 422. Comportamento confirmado pelo BDD `boundary-ports` Test 2 e por `get-layout-preview`/`update-layout` specs. Nao marcado por divergir do texto literal da issue; requer decisao do arquiteto se deve mudar para 422 ou se o texto da issue deve ser corrigido para "stale".
- [x] Re-sending identical PUT body makes 1 total repository write — `ConfiguracaoLayout.equalsInput()` + no-op path em `UpdateLayoutUseCase`, testado
- [x] `LayoutUpdated` emitted exactly once per successful mutating PUT — via `DomainEventEmitter`, nao emitido no caminho no-op, testado
- [x] `pnpm test` on the use case spec exits 0

## Dependencias

- COMP-006 (precede — ConfiguracaoLayout aggregate + LayoutOverride entity)
- COMP-001 (precede — DI tokens `UPDATE_LAYOUT_USE_CASE`, `MANUSCRIPT_CONTENT_PORT` declared)

## Estimativa
M

## Prioridade
P2
