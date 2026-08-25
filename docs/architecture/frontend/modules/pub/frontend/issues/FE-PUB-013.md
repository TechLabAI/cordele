## [FE-PUB-013] ExportProgressCardComponent — fase gerando (indeterminado) e error + retry

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/pub/ui/src/lib/export-progress-card/export-progress-card.component.ts` é um componente
presentacional que renderiza o cartão de progresso de exportação: fase `gerando` mostra
indicador indeterminado "Gerando seu ePub…" (sem % numérico); fase `error` mostra mensagem e
output `retry`. Sem lógica de negócio, sem HttpClient.

**Context / Problem statement:**
- SPEC-02 §1 define ExportProgressCardComponent: input `phase` ('gerando'|'error'), input `fileName`.
- ADR-PUB-001 e D-N: progresso sempre indeterminado; sem SSE. O `setInterval` do protótipo (60%)
  está removido (FE-PUB-012).
- Phase 'error': exibe mensagem de falha + botão "Tentar novamente" (output `retry`).
- Bloqueia: FE-PUB-012 (ExportacaoEValidacaoComponent usa este componente)

**Approach (execution path):**
1. Criar `libs/pub/ui/src/lib/export-progress-card/export-progress-card.component.ts`:
   - `standalone: true`, `OnPush`
   - `input()`: phase: 'gerando'|'error', fileName: string
   - `output()`: retry: OutputEmitterRef
   - phase='gerando': spinner/progress bar indeterminado + texto "Gerando seu ePub…"
   - phase='error': ícone de erro + mensagem + botão "Tentar novamente" (emit retry)
   - Sem HttpClient, sem injeção de facades

**Non-goals:**
- Não exibe veredito epubcheck (FE-PUB-014).
- Não exibe KPIs (FE-PUB-015).

**Layer(s):**
frontend / libs/pub/ui

**Bounded context:**
pub

**Service execution spec(s):**
- `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-02-component-hierarchy.md` (§1 ExportProgressCardComponent)
- `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-03-view-models.md` (§1 ExportPhase)

**Architecture alignment:**
- Tag Nx: `scope:pub`, `type:ui`
- Standalone + OnPush; zero dependência de facade ou HttpClient

**Implementation checklist (by file):**

**Lib: libs/pub/ui**
- 🔲 `libs/pub/ui/src/lib/export-progress-card/export-progress-card.component.ts`
- 🔲 `libs/pub/ui/src/lib/export-progress-card/export-progress-card.component.html`
- 🔲 `libs/pub/ui/src/index.ts` (re-exports)

**Tests**
- 🔲 `nx test pub-ui` PASS (phase=gerando: spinner visível, sem %numeric; phase=error: retry emitido)
- 🔲 `nx lint pub-ui` PASS

**Milestone:**
Wave 3 / P3 Feature Libs

**Labels:**
type:feature
layer:frontend
scope:pub
priority:P3

**Acceptance criteria:**
- `npx nx test pub-ui` PASS
- phase=gerando: nenhum texto com "%" numérico visível
- phase=error: click "Tentar novamente" → retry emitido
- Sem referência a setInterval ou setTimeout internamente

**Dependencies:**
- FE-PUB-012 (ExportacaoEValidacaoComponent usa este componente)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum

**Testing / Evidence required:**
- DOM: spinner indeterminado presente em phase=gerando; botão presente em phase=error

**Risks / Notes:**
- Se @cordele/shared/ui-feedback já tem um spinner/progress component, reutilizá-lo em vez de criar novo.
