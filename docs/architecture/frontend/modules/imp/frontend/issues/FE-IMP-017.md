## [FE-IMP-017] RevisaoDeEstruturaComponent (smart, T04)

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/imp/feature-review/src/lib/revisao-de-estrutura.component.ts` implementa o smart component
de T04: lê signals de `ReviewFacade`, hidrata via resposta do POST ou via GET único em deep-link,
delega eventos de ignore/confirm à facade e navega para COMP após confirm bem-sucedido.

**Context / Problem statement:**
- SPEC-02 §2 e SPEC-04 §3 definem o comportamento de T04.
- Duas entradas possíveis: (a) navegação pós-upload → `ReviewFacade.hydrateFrom(detail)` direto;
  (b) deep-link/reload → `ReviewFacade.load(manuscritoId)` que emite `status=loading → ready`.
- `ignoreFragment(id)` delega à facade (que agora tem rollback real — addendum M4).
- `confirmEstrutura()` delega à facade; em sucesso a facade emite `projetoId` e o componente
  navega para `/comp/config?projetoId=...` (IMP não possui a rota COMP).
- Feature flag `imp.ignoreFragment` controla visibilidade do botão "Ignorar" (passa `ignoreDisabled`
  a `PendingFragmentsPanelComponent`).
- Bloqueia: FE-IMP-024 (e2e revisao-de-estrutura), INT-FE-IMP-003 (handoff COMP)

**Approach (execution path):**
1. Criar `RevisaoDeEstruturaComponent` (standalone OnPush):
   - `inject(ReviewFacade)`, `inject(Router)`, `inject(ActivatedRoute)`
   - No `ngOnInit`:
     - Se `history.state.manuscritoDetail` presente → `facade.hydrateFrom(detail)`.
     - Senão → `facade.load(manuscritoId)` (do route param).
   - Template usa `StepBarComponent`, `ManuscriptHeaderComponent`, `ParsingSummaryComponent`,
     `ChapterTocComponent`, `PendingFragmentsPanelComponent`, `ReviewActionsBarComponent`.
2. Handler `onIgnore(id)` → `facade.ignoreFragment(id)`.
3. Handler `onConfirm()` → `facade.confirmEstrutura()`.
4. Efeito: quando `facade.confirmResult()` (ou sinal de sucesso) emitido → `Router.navigate(['/comp/config'], { queryParams: { projetoId } })`.
5. Handler `onReimp()` → navegar de volta para a rota de upload de origem (via `ActivatedRoute` ou history).
6. Ler `imp.ignoreFragment` flag → passar `ignoreDisabled` ao painel.

**Non-goals:**
- Não implementa os componentes filhos (FE-IMP-014, FE-IMP-015, FE-IMP-016).
- Não implementa a rota COMP (pertence ao módulo COMP).

**Layer(s):**
frontend / libs/imp/feature-review

**Bounded context:**
imp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/SPEC-02-component-hierarchy.md` (§2)
- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/SPEC-04-data-access.md` (§3)
- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/SPEC-05-tool-contract.md` (§2, §3)

**Architecture alignment:**
- Standalone + OnPush + Signals
- Tag Nx: `scope:imp`, `type:feature`

**Implementation checklist (by file):**

**Lib: libs/imp/feature-review**
- 🔲 `libs/imp/feature-review/src/lib/revisao-de-estrutura.component.ts`
- 🔲 `libs/imp/feature-review/src/lib/revisao-de-estrutura.component.html`
- 🔲 `libs/imp/feature-review/src/index.ts` (re-export)

**Tests**
- 🔲 `nx test imp-feature-review` PASS:
  - hydrateFrom chamado quando state presente em history
  - load(manuscritoId) chamado em deep-link (sem state)
  - onConfirm → facade.confirmEstrutura chamado → navigate para /comp/config
  - onIgnore → facade.ignoreFragment chamado
  - imp.ignoreFragment flag off → ignoreDisabled=true passado ao painel
- 🔲 `nx lint imp-feature-review` PASS

**Milestone:**
Wave 3 / P3 Feature Libs

**Labels:**
type:feature
layer:frontend
scope:imp
priority:P3

**Acceptance criteria:**
- `npx nx test imp-feature-review` PASS
- `npx nx lint imp-feature-review` PASS
- `npx nx build imp-feature-review` PASS
- Entrada via deep-link → um único GET emitido (confirmado via spy em ManuscriptApiService)
- Confirm bem-sucedido → navigate para `/comp/config?projetoId=...`

**Dependencies:**
- FE-IMP-011 (ReviewFacade)
- FE-IMP-014 (ManuscriptHeader, ParsingSummary, CounterTile)
- FE-IMP-015 (ChapterToc, PendingFragmentsPanel)
- FE-IMP-016 (ReviewActionsBar)
- FE-IMP-018 (StepBarComponent)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Indiretamente via ReviewFacade → ManuscriptApiService

**Testing / Evidence required:**
- Screenshots: loading (skeletons), ready com capítulos e pendências, confirmando (spinner)

**Risks / Notes:**
- A navegação para COMP usa rota `/comp/config` que pode não existir ainda (módulo COMP não
  implementado). Usar `router.navigate` sem `canActivate` para não bloquear.
- `history.state.manuscritoDetail` é a forma mais simples de passar o body 201 de T03 para T04;
  alternativa: signal compartilhado via service — decidir na implementação.
