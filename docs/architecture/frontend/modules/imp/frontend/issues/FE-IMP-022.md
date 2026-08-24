## [FE-IMP-022] Loading states, skeletons e reason-label fallback

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
T04 exibe skeleton states corretos durante `status='loading'` (deep-link/reload) e o
`ReasonLabelPipe` é robusto ao fallback "Não classificado" para reasons desconhecidos.
T03 exibe estado idle correto quando sem arquivo selecionado.

**Context / Problem statement:**
- SPEC-03 critério `imp-deeplink-single-get`: "WHILE status='loading' THE SYSTEM SHALL render
  skeleton counters and SHALL NOT render confirm action as enabled".
- SPEC-03 critério `imp-reason-fallback`: reasons fora do enum → "Não classificado".
- SPEC-03 critério `imp-pending-always`: painel não deve ser ocultado durante loading.

**Approach (execution path):**
1. Adicionar skeleton CSS ao `ManuscriptHeaderComponent`, `CounterTileComponent` e
   `ChapterTocComponent` (animação `@cordele/shared/ui-theme` skeleton token ou classe utilitária).
2. `ReviewActionsBarComponent` passa `canConfirm=false` enquanto `status='loading'`.
3. `PendingFragmentsPanelComponent` exibe mensagem placeholder "Carregando pendências..." durante
   loading em vez de lista vazia.
4. Confirmar que `ReasonLabelPipe.transform(unknown) === 'Não classificado'` (pode estar em FE-IMP-015
   — esta issue garante cobertura de teste específica do fallback).
5. Testar estado idle do T03 (campo de nome vazio, DropZone vazio, botão desabilitado).

**Non-goals:**
- Não cria skeletons de design novo — usa tokens/classes do design system existente.

**Layer(s):**
frontend / libs/imp/feature-review, libs/imp/feature-upload

**Bounded context:**
imp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/SPEC-03-view-models.md` (§2)
- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/SPEC-07-error-handling.md` (§3)

**Architecture alignment:**
- Standalone + OnPush + Signals
- Tag Nx: `scope:imp`, `type:feature`

**Implementation checklist (by file):**

**Libs: imp/feature-review + imp/feature-upload**
- 🔲 Skeleton classes em `ManuscriptHeaderComponent`, `CounterTileComponent`, `ChapterTocComponent`
- 🔲 `ReviewActionsBarComponent`: `canConfirm=false` durante loading
- 🔲 `PendingFragmentsPanelComponent`: placeholder loading

**Tests**
- 🔲 `nx test imp-feature-review` PASS:
  - status='loading' → canConfirm=false
  - status='loading' → skeletons visíveis nos contadores
- 🔲 `nx lint imp-feature-review` PASS

**Milestone:**
Wave 5 / P7 UX Polish

**Labels:**
type:feature
layer:frontend
scope:imp
priority:P7

**Acceptance criteria:**
- `npx nx test imp-feature-review` PASS
- `npx nx lint imp-feature-review` PASS
- `npx nx build imp-feature-review` PASS
- `status='loading'` → botão confirmar desabilitado
- `status='loading'` → skeleton nos contadores

**Dependencies:**
- FE-IMP-014 (ManuscriptHeader, CounterTile)
- FE-IMP-015 (PendingFragmentsPanel)
- FE-IMP-016 (ReviewActionsBar)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum

**Testing / Evidence required:**
- Screenshot do estado loading (skeletons em todos os contadores)

**Risks / Notes:**
- Tokens de skeleton do design system — verificar se `@cordele/shared/ui-theme` os provê.
