## [FE-IMP-011] ReviewFacade — estado de revisão, ignoreFragment com rollback real, confirmEstrutura

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/imp/data-access/src/lib/facades/review.facade.ts` implementa a `ReviewFacade`:
hidrata T04 via `POST` body ou `GET` single (deep-link), expõe `StructureReviewVM` como signals,
implementa `ignoreFragment()` com otimismo + rollback real em 4xx/5xx (addendum M4) e
`confirmEstrutura()` chamando `POST /confirm-estrutura` antes de navegar ao COMP.

**Context / Problem statement:**
- **Mudança critica do addendum M4:** `ignoreFragment` deixa de ser client-only; o rollback passa a
  ser SEMPRE executado em caso de 4xx/5xx (não mais "inerte/condicional"). O warning registrado em M4
  (`imp-ignore-rollback` era "if server endpoint exists") está resolvido: o endpoint existe.
- **Mudança critica do addendum M4:** `confirmEstrutura` chama `POST /confirm-estrutura` (avança
  `rascunho → em_composicao` via porta PROJ) antes de navegar. Erros 422/5xx devem ser tratados.
- Deep-link: ao entrar em T04 sem estado em memória, `load(manuscritoId)` faz `GET` manuscrito +
  `GET ignoredSegmentos` (para restaurar estado de ignore).
- Bloqueia: FE-IMP-017 (RevisaoDeEstruturaComponent)

**Approach (execution path):**
1. Criar `ReviewFacade` com `inject(ManuscriptApiService)`, signals writable internos:
   `_status`, `_manuscrito`, `_totalCapitulos`, `_totalImagens`, `_trechosNaoParseados`,
   `_capitulos`, `_pendencias`, `_confirming`.
2. Expor readonly signals + computed: `status`, `manuscrito`, `totalCapitulos`, `totalImagens`,
   `trechosNaoParseados`, `capitulos`, `pendencias`, `canConfirm`, `hasZeroChapters`,
   `pendingCount`, `confirming`.
3. `hydrateFrom(detail: ManuscritoDetail)`: popula todos os signals diretamente do body 201.
4. `load(manuscritoId)`: faz `GET getById` + `GET getIgnoredSegmentos` em paralelo (`forkJoin`);
   marca segmentos ignorados em `TrechoVM.ignorado`.
5. `ignoreFragment(id)`:
   - Otimismo imediato: `TrechoVM.ignorado = true`.
   - Chama `ManuscriptApiService.ignoreSegmento()`.
   - Em sucesso: confirmar (nada a fazer — já está marcado).
   - Em erro (4xx/5xx): reverter `TrechoVM.ignorado = false` + emitir toast via
     `FeedbackService` ("Não foi possível ignorar o trecho — tente novamente").
6. `confirmEstrutura()`:
   - `_confirming.set(true)`.
   - Chama `ManuscriptApiService.confirmEstrutura()`.
   - Em sucesso 200: emitir `projetoId` para navegação; caller (RevisaoDeEstruturaComponent) navega.
   - Em erro: `_confirming.set(false)` + banner de erro.
7. `reimport()`: emite evento para o componente navegar de volta.

**Non-goals:**
- Não implementa componentes (FE-IMP-017).
- Não implementa a navegação (responsabilidade do componente smart).

**Layer(s):**
frontend / libs/imp/data-access

**Bounded context:**
imp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/SPEC-04-data-access.md` (§3, §5 reconciliado)
- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/SPEC-03-view-models.md` (§2, §3)
- `docs/architecture/backend/services/imp-service/contracts/api-contract.md` (§8.1, §8.2)

**Architecture alignment:**
- Signals-first, sem NgRx
- Tag Nx: `scope:imp`, `type:data-access`

**Implementation checklist (by file):**

**Lib: libs/imp/data-access**
- 🔲 `libs/imp/data-access/src/lib/facades/review.facade.ts`
- 🔲 `libs/imp/data-access/src/index.ts` (re-export)

**Tests**
- 🔲 `nx test imp-data-access` PASS:
  - hydrateFrom popula todos os signals
  - load emite `loading → ready` e restaura segmentos ignorados
  - ignoreFragment: otimismo imediato + rollback em 422
  - confirmEstrutura: confirming=true → success → projetoId emitido
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
- `ignoreFragment` reverte estado em caso de erro 4xx/5xx (rollback obrigatório)
- `confirmEstrutura` chama `ManuscriptApiService.confirmEstrutura` antes de emitir navegação
- Deep-link `load()` chama `getById` + `getIgnoredSegmentos` em paralelo

**Dependencies:**
- FE-IMP-008 (getById, getEstrutura, listByProjeto)
- FE-IMP-009 (ignoreSegmento, confirmEstrutura da API)
- FE-IMP-006 (DTOs)

**Data impact:**
- Nenhum client-side persistente

**API / Contract impact:**
- POST /api/imp/manuscripts/{id}/segmentos/{segId}/ignore (§8.1)
- DELETE /api/imp/manuscripts/{id}/segmentos/{segId}/ignore (§8.1)
- GET /api/imp/manuscripts/{id}/segmentos/ignored (§8.1)
- POST /api/imp/manuscripts/{id}/confirm-estrutura (§8.2)

**Testing / Evidence required:**
- Teste de rollback: `ignoreSegmento` falha → `TrechoVM.ignorado` retorna a `false`
- Teste de toast: `FeedbackService.show` chamado no rollback

**Risks / Notes:**
- WARNING M4 RESOLVIDO: `imp-ignore-rollback` deixou de ser condicional. O rollback DEVE ser
  implementado como obrigatório nesta issue.
- `confirming` signal deve ser resetado em ERRO para não travar o botão de confirmar.
