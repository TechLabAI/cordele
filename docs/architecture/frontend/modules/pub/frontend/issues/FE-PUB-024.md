## [FE-PUB-024] Loading states, error banners e empty states unificados (T07 + T08)

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
ExportacaoEValidacaoComponent e DownloadEHistoricoComponent exibem estados de loading/error/empty
consistentes com @cordele/shared/ui-feedback: skeleton loader durante carregamento, error banner
retryável (5xx / network), sem estado "gerando" fantasma que nunca resolve.

**Context / Problem statement:**
- SPEC-07 §3: canais de erro (banner, inline, modal, toast) por URN.
- SPEC-07 §4: toda falha exibe traceId (X-Correlation-Id).
- SPEC-07 §2 (5xx/network): banner retryável — sem phantom "gerando".
- T08 HistoryFacade.status === 'loading': skeleton ou spinner enquanto forkJoin resolve.

**Approach (execution path):**
1. Em ExportacaoEValidacaoComponent (FE-PUB-012): wiring de phase='error' → ExportProgressCardComponent
   com mensagem de erro + retry; traceId exibido no card.
2. Em DownloadEHistoricoComponent (FE-PUB-018): wiring de status='error' → error banner com retry;
   status='loading' → loading skeleton.
3. Verificar que pub-error-map.ts (FE-PUB-011) cobre todos os URNs com canal correto.
4. Confirmar que nenhum estado de erro mostra "gerando" como fase após uma falha de network.

**Non-goals:**
- Não implementa os componentes de erro em si (delegado a @cordele/shared/ui-feedback).

**Layer(s):**
frontend / libs/pub/feature-export + libs/pub/feature-history

**Bounded context:**
pub

**Service execution spec(s):**
- `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-07-error-handling.md` (§2, §3, §4)

**Architecture alignment:**
- Tag Nx: `scope:pub`, `type:feature`
- traceId em todo erro renderizado

**Implementation checklist (by file):**

**Lib: libs/pub/feature-export + feature-history**
- 🔲 Wiring error→phase='error' em ExportacaoEValidacaoComponent
- 🔲 traceId exibido em ExportProgressCardComponent fase error
- 🔲 Wiring status='error' em DownloadEHistoricoComponent
- 🔲 Loading skeleton em DownloadEHistoricoComponent (status='loading')

**Tests**
- 🔲 `nx test pub-feature-export` PASS (network error → phase=error com traceId; sem phantom gerando)
- 🔲 `nx test pub-feature-history` PASS (status=loading → skeleton; status=error → banner retryável)
- 🔲 `nx lint pub-feature-export` + `nx lint pub-feature-history` PASS

**Milestone:**
Wave 7 / P7 UX Polish

**Labels:**
type:feature
layer:frontend
scope:pub
priority:P7

**Acceptance criteria:**
- phase=error: traceId visível no card de erro
- network 5xx antes de existir publicacao → phase=error (nunca phase=gerando congelado)
- status=loading T08: skeleton visível; status=error T08: botão retry presente

**Dependencies:**
- FE-PUB-009 (ExportFacade states), FE-PUB-010 (HistoryFacade states), FE-PUB-011 (error map)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum

**Testing / Evidence required:**
- Fake http error → fase e canal de erro corretos; traceId no DOM

**Risks / Notes:**
- Verificar que @cordele/shared/ui-feedback tem componentes reutilizáveis para skeleton/error banner antes de criar custom.
