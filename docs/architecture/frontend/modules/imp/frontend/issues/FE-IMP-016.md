## [FE-IMP-016] ReviewActionsBar + modal de confirmação de zero capítulos

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/imp/feature-review/src/lib/components/review-actions-bar/` contém `ReviewActionsBarComponent`
com os dois CTAs de T04 ("Reimportar outro arquivo" e "Confirmar estrutura") e o modal de aviso
para confirmação de manuscrito com zero capítulos.

**Context / Problem statement:**
- SPEC-02 §2 define `ReviewActionsBarComponent` com `canConfirm`, `confirming`, `hasZeroChapters`.
- SPEC-07 §3 define que `totalCapitulos === 0` abre modal de confirmação antes de prosseguir.
- "Confirmar estrutura" permanece habilitado mesmo com pendências (critério `imp-confirm-pending`).
- O botão "Confirmar" mostra spinner enquanto `confirming === true` (facade em chamada de API).
- Bloqueia: FE-IMP-017 (RevisaoDeEstruturaComponent)

**Approach (execution path):**
1. Criar `ReviewActionsBarComponent` (standalone OnPush):
   - `input() canConfirm, confirming, hasZeroChapters`: Signals
   - Botão "Reimportar outro arquivo": `output() reimport()`
   - Botão "Confirmar estrutura": `output() confirm()` — habilitado quando `canConfirm && !confirming`;
     spinner quando `confirming`.
   - Quando clicado e `hasZeroChapters === true`: abre modal interno antes de emitir `confirm()`.
2. Modal de zero capítulos: dialog inline ou `@angular/cdk/dialog`:
   - Texto: "Este manuscrito não tem capítulos detectados. Confirmar assim mesmo?"
   - Botões: "Cancelar" / "Confirmar mesmo assim"
   - Só emite `confirm()` se o editor escolher "Confirmar mesmo assim".
3. `confirming === true` desabilita ambos os botões (evitar duplo submit).

**Non-goals:**
- Não implementa a navegação pós-confirm (responsabilidade de `RevisaoDeEstruturaComponent`).
- Não implementa o toast de ignore-rollback (FE-IMP-021).

**Layer(s):**
frontend / libs/imp/feature-review

**Bounded context:**
imp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/SPEC-02-component-hierarchy.md` (§2)
- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/SPEC-07-error-handling.md` (§3 — modal)
- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/SPEC-03-view-models.md` (§2)

**Architecture alignment:**
- Standalone + OnPush + Signals
- Tag Nx: `scope:imp`, `type:feature`

**Implementation checklist (by file):**

**Lib: libs/imp/feature-review**
- 🔲 `libs/imp/feature-review/src/lib/components/review-actions-bar/review-actions-bar.component.ts`
- 🔲 `libs/imp/feature-review/src/lib/components/review-actions-bar/review-actions-bar.component.html`
- 🔲 `libs/imp/feature-review/src/lib/components/zero-chapters-modal/zero-chapters-modal.component.ts`

**Tests**
- 🔲 `nx test imp-feature-review` PASS:
  - `hasZeroChapters=true` e clique em confirmar → modal abre
  - Modal "Cancelar" → confirm NÃO emitido
  - Modal "Confirmar mesmo assim" → confirm emitido
  - `confirming=true` → botão desabilitado + spinner
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
- `hasZeroChapters=true` → modal antes de emitir confirm
- `confirming=true` → ambos CTAs desabilitados

**Dependencies:**
- (nenhuma — componente presentacional)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum (emite evento; facade chama API)

**Testing / Evidence required:**
- Screenshot do modal de zero capítulos

**Risks / Notes:**
- Se `@cordele/shared/ui-feedback` já tiver um componente de dialog genérico, usar em vez de
  criar `zero-chapters-modal` do zero.
