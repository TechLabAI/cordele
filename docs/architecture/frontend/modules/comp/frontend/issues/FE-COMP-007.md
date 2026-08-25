## [FE-COMP-007] LayoutApiService — GET/PUT layout, GET preview-context

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/comp/data-access/src/lib/layout-api.service.ts` implementa 3 operações HTTP:
`getLayout(id)`, `upsertLayout(id, body)` e `getPreviewContext(id)`. O preview é lido num
único GET (dados: árvore+layout+overrides — cliente renderiza, D-K). DTOs mapeiam
api-contract §6.2/§6.3/§6.4.

**Context / Problem statement:**
- SPEC-04 §1 especifica os 3 endpoints de Layout/Preview.
- `GET .../layout` retorna `ConfiguracaoLayout` (`materialized:false` se nunca salvo, D-M).
- `PUT .../layout` carrega tipografia + overrides de alinhamento não-stale (`tipo=imagem` apenas);
  retorna `200` ou `400/422` (override-ref-not-found, structural-edit-deferred).
- `GET .../preview-context` retorna `PreviewContext` (árvore + layout + overrides); pode
  retornar `409 manuscript-missing` se não há manuscrito importado.
- FE **nunca** chama endpoint do IMP (D-K); o COMP junta em-process.
- Bloqueia: FE-COMP-009 (LayoutFacade)

**Approach (execution path):**
1. Criar `LayoutApiService` com `@Injectable({ providedIn: 'root' })`.
2. Implementar `getLayout(projetoId): Observable<ConfiguracaoLayoutDto>`.
3. Implementar `upsertLayout(projetoId, body: UpsertLayoutDto): Observable<ConfiguracaoLayoutDto>`.
   - Body inclui `LayoutParamsVM` + `AlignmentOverrideDto[]` (somente não-stale, tipo=imagem).
4. Implementar `getPreviewContext(projetoId): Observable<PreviewContextDto>`.
5. Definir DTOs em `layout.dto.ts`.

**Non-goals:**
- Não implementa a Facade (FE-COMP-009).
- Não chama nenhum endpoint de `imp-service`.
- Não faz cache (re-fetch sempre na entrada, SPEC-04 §1).

**Layer(s):**
frontend / libs/comp/data-access

**Bounded context:**
comp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-04-data-access.md` (§1, §3)
- `docs/architecture/frontend/modules/comp/frontend/contracts/backend-api-cross-link.md` (§1, §2)

**Architecture alignment:**
- Tag Nx: `scope:comp`, `type:data-access`
- `tipo` no payload de PUT é sempre `imagem`; nunca `em-branco` (D-H)

**Implementation checklist (by file):**

**Lib: libs/comp/data-access**
- 🔲 `libs/comp/data-access/src/lib/layout-api.service.ts`
- 🔲 `libs/comp/data-access/src/lib/layout.dto.ts`

**Tests**
- 🔲 `nx test comp-data-access` PASS (GET layout, PUT layout body correto, GET preview-context)
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
- PUT layout nunca inclui `tipo=em-branco` no payload (teste unitário)
- `getPreviewContext` retorna `Observable<PreviewContextDto>` sem chamar imp-service

**Dependencies:**
- FE-COMP-001, INT-FE-COMP-001 (interceptors)

**Data impact:**
- Nenhum no FE

**API / Contract impact:**
- Consome `/api/comp/projetos/{projetoId}/layout` (GET/PUT) e `.../preview-context` (GET)

**Testing / Evidence required:**
- Testes com `HttpTestingController`; verificar que payload de PUT não contém `tipo=em-branco`

**Risks / Notes:**
- O body do PUT deve excluir overrides stale antes de enviar; essa filtragem é responsabilidade da Facade (FE-COMP-009), não do ApiService.
