## [FE-COMP-009] LayoutFacade — signals, state machine T06, paginação, export pessimista

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/comp/data-access/src/lib/layout.facade.ts` implementa `LayoutFacade` com signals
readonly (`status`, `layout`, `overrides`, `preview`, `saving`, `canExport`) e os métodos
de UI: `onStyleChange`, `onAlignmentChange`, `onPrevPage`, `onNextPage`, `onExport`,
`onRetryPreview`. GET layout e preview-context em paralelo na entrada; export pessimista.

**Context / Problem statement:**
- SPEC-03 §2 define `LayoutVM` completo.
- SPEC-04 §2 especifica a máquina de estados (loading/ready/error/empty/saving) e a
  forkJoin de GET layout + GET preview-context.
- `409 manuscript-missing` → estado `empty` (painel de estilos ainda visível).
- Live repaint de tipografia e alinhamento: **nenhuma chamada de rede**; persiste só no export.
- Export: PUT layout com tipografia + overrides não-stale (`tipo=imagem`); nunca envia `tipo=em-branco`.
- `canExport = params dentro dos limites && h1 ≥ h2 ≥ h3`.
- Bloqueia: FE-COMP-014 (EditorDeLayoutPreviewComponent)

**Approach (execution path):**
1. Criar `LayoutFacade` como `@Injectable({ providedIn: 'root' })`.
2. `loadData(projetoId)`: `forkJoin([getLayout(id), getPreviewContext(id)])`;
   - `409` em preview-context → `status='empty'`; layout carregado normalmente.
   - `5xx/network` → `status='error'`.
3. `onStyleChange(param, value)`: update `_layout` signal local; clamp ao limite; enforce `h1≥h2≥h3`.
4. `onAlignmentChange(referenciaNo, alinhamento)`: upsert override na lista local (não stale).
5. `onPrevPage()` / `onNextPage()`: ajusta `_preview.index` — sem rede.
6. `onExport()`: `_saving=true` → PUT layout com overrides não-stale → 200 → navigate PUB;
   - `400` → saving=false (defensivo); `422 override-ref-not-found` → toast + salva edições;
   - `5xx` → toast + preserva edições.
7. Overrides stale: excluídos do applied preview e do payload de export; surfaced como notice.
8. Cancelar com `takeUntilDestroyed`.

**Non-goals:**
- Não renderiza pixels (renderização client-side no componente).
- Não chama IMP service.
- Não faz auto-save nem optimistic update.

**Layer(s):**
frontend / libs/comp/data-access

**Bounded context:**
comp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-03-view-models.md` (§2)
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-04-data-access.md` (§2, §3)

**Architecture alignment:**
- Tag Nx: `scope:comp`, `type:data-access`
- `forkJoin` para GET paralelo; `switchMap` para cancelamento
- Payload de PUT nunca inclui `tipo=em-branco` (filtro antes do envio)

**Implementation checklist (by file):**

**Lib: libs/comp/data-access**
- 🔲 `libs/comp/data-access/src/lib/layout.facade.ts`
- 🔲 `libs/comp/data-access/src/index.ts` (re-export LayoutFacade)

**Tests**
- 🔲 `nx test comp-data-access` PASS
  - forkJoin: `409` em preview → status='empty', painel ok
  - `onStyleChange` clamp h1≥h2≥h3
  - `onExport` exclui stale do payload; nunca envia `tipo=em-branco`
  - Export 422 → toast, edições preservadas
- 🔲 `nx lint comp-data-access` PASS

**Milestone:**
Wave 2 / P2 Data access

**Labels:**
type:feature
layer:frontend
scope:comp
priority:P2

**Acceptance criteria:**
- `npx nx test comp-data-access` PASS
- `onStyleChange` e `onAlignmentChange` não emitem requisições HTTP
- Export PUT não contém overrides stale nem `tipo=em-branco`
- `409 manuscript-missing` → `status='empty'`; painel de estilos acessível

**Dependencies:**
- FE-COMP-007 (LayoutApiService)

**Data impact:**
- Nenhum no FE (persiste no PUT a pedido do utilizador)

**API / Contract impact:**
- Chama `LayoutApiService` (FE-COMP-007)

**Testing / Evidence required:**
- Teste de estado: forkJoin → ready; export → saving → navigate/restore
- Teste de filtragem de overrides stale no payload

**Risks / Notes:**
- Defaults lazy (materialized:false): panel deve hidratar com valores §7.2 (serif/12/1.5/20/28/22/18) mesmo se nunca salvo.
