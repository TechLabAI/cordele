## [FE-IMP-009] ManuscriptApiService — endpoints ignore/confirm (addendum M4)

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`ManuscriptApiService` expõe `ignoreSegmento()`, `unignoreSegmento()`, `getIgnoredSegmentos()` e
`confirmEstrutura()` — os quatro endpoints do addendum BE (api-contract §8).

**Context / Problem statement:**
- O addendum aterrissado em M4 adicionou ao contrato BE:
  - `POST .../segmentos/{segmentoId}/ignore` → 201 | 200 (idempotente) | 422 segmento-not-found
  - `DELETE .../segmentos/{segmentoId}/ignore` → 204 | 404
  - `GET .../segmentos/ignored` → 200 `{ ignoredSegmentoIds[] }`
  - `POST .../confirm-estrutura` → 200 `ConfirmEstruturaResultDto`
- Com estes endpoints o FE deixa de ser client-only/otimista sem rollback real: `ignoreFragment`
  agora chama a API; em caso de 4xx/5xx o rollback deve reverter o estado (não era inerte como em M3).
- `confirmEstrutura` agora chama a API real (avança `rascunho → em_composicao`), não só navega.
- Bloqueia: FE-IMP-011 (ReviewFacade usa estes métodos)

**Approach (execution path):**
1. Adicionar a `ManuscriptApiService`:
   - `ignoreSegmento(manuscritoId, segmentoId): Observable<SegmentoCuradoriaDto>`
     → `POST /api/imp/manuscripts/{manuscritoId}/segmentos/{segmentoId}/ignore`
   - `unignoreSegmento(manuscritoId, segmentoId): Observable<void>`
     → `DELETE /api/imp/manuscripts/{manuscritoId}/segmentos/{segmentoId}/ignore`
   - `getIgnoredSegmentos(manuscritoId): Observable<{ ignoredSegmentoIds: string[] }>`
     → `GET /api/imp/manuscripts/{manuscritoId}/segmentos/ignored`
   - `confirmEstrutura(manuscritoId): Observable<ConfirmEstruturaResultDto>`
     → `POST /api/imp/manuscripts/{manuscritoId}/confirm-estrutura`
2. `ignoreSegmento` trata 200 (idempotente) como sucesso (não lança erro).
3. `unignoreSegmento` trata 404 como "já não estava ignorado" → erro observable para o facade decidir.
4. `confirmEstrutura` não auto-retry (escrita não-idempotente).

**Non-goals:**
- Não implementa a facade que coordena otimismo + rollback (FE-IMP-011).

**Layer(s):**
frontend / libs/imp/data-access

**Bounded context:**
imp

**Service execution spec(s):**
- `docs/architecture/backend/services/imp-service/contracts/api-contract.md` (§8.1, §8.2, §8.3)
- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/SPEC-04-data-access.md` (§5 — reconciliado M4)

**Architecture alignment:**
- Tag Nx: `scope:imp`, `type:data-access`

**Implementation checklist (by file):**

**Lib: libs/imp/data-access**
- 🔲 `libs/imp/data-access/src/lib/services/manuscript-api.service.ts` (4 métodos addendum)

**Tests**
- 🔲 `nx test imp-data-access` PASS (4 testes de endpoint — URLs + métodos HTTP corretos)
- 🔲 `nx lint imp-data-access` PASS

**Milestone:**
Wave 2 / P2 Data Access

**Labels:**
type:feature
layer:frontend
scope:imp
priority:P2

**Acceptance criteria:**
- `npx nx test imp-data-access` PASS
- `npx nx lint imp-data-access` PASS
- `npx nx build imp-data-access` PASS
- `ignoreSegmento` aceita 200 e 201 como sucesso
- `confirmEstrutura` usa POST (não GET)

**Dependencies:**
- FE-IMP-006 (SegmentoCuradoriaDto, ConfirmEstruturaResultDto)
- FE-IMP-007 (ManuscriptApiService base)

**Data impact:**
- Nenhum client-side

**API / Contract impact:**
- POST /api/imp/manuscripts/{id}/segmentos/{segId}/ignore (§8.1)
- DELETE /api/imp/manuscripts/{id}/segmentos/{segId}/ignore (§8.1)
- GET /api/imp/manuscripts/{id}/segmentos/ignored (§8.1)
- POST /api/imp/manuscripts/{id}/confirm-estrutura (§8.2)

**Testing / Evidence required:**
- Testes com `HttpTestingController` para cada um dos 4 endpoints

**Risks / Notes:**
- Esta issue existia como "gap para M4" em SPEC-04 §5 e backend-api-cross-link §6. O addendum
  aterrisou: implementar sem fallback client-only.
- `getIgnoredSegmentos` é chamado no hydrate de T04 (deep-link/reload) para restaurar o estado
  de ignore no ReviewFacade.
