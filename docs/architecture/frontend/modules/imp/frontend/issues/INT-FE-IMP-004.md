## [INT-FE-IMP-004] Integração AccessDecisionService — checks de permissão IMP

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
Todas as verificações de permissão de IMP (imp.import, imp.review, imp.confirm, imp.ignoreFragment)
passam por `AccessDecisionService.can()` de `@cordele/shared/access-decision`. Nenhum componente
testa roles diretamente.

**Context / Problem statement:**
- SPEC-05 §2 e critério `imp-flag-accessdecision` definem que `AccessDecisionService` é o único
  árbitro de permissões — componentes não testam roles diretamente.
- `imp.confirm` controla visibilidade/habilitação do botão "Confirmar estrutura".
- `imp.ignoreFragment` controla visibilidade do botão "Ignorar" (feature flag, mas implementado
  via `AccessDecisionService` para consistência).
- `accessGuard('imp.import')` e `accessGuard('imp.review')` já usam o serviço (FE-IMP-002).

**Context / Approach:**
1. Em `RevisaoDeEstruturaComponent`: verificar `AccessDecisionService.can('imp.confirm')` →
   passar resultado como `canConfirm` input ao `ReviewActionsBarComponent`.
2. Em `RevisaoDeEstruturaComponent`: verificar `AccessDecisionService.can('imp.ignoreFragment')` →
   passar `ignoreDisabled` ao `PendingFragmentsPanelComponent` (quando flag off ou sem permissão).
3. Verificar que nenhum `if (user.role === 'admin')` aparece nos componentes FE.
4. Teste: `AccessDecisionService.can('imp.confirm') === false` → botão confirmar desabilitado no DOM.

**Non-goals:**
- Não implementa `AccessDecisionService` (pertence a `@cordele/shared`).
- Não implementa os guards (FE-IMP-019).

**Layer(s):**
frontend / libs/imp/feature-review (consumidor do shared)

**Bounded context:**
imp (cross-cutting access)

**Service execution spec(s):**
- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/SPEC-05-tool-contract.md` (§2, §3)
- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/SPEC-01-route-map.md` (§3)

**Architecture alignment:**
- Tag Nx: `scope:imp`, `type:feature`

**Implementation checklist (by file):**

**Lib: libs/imp/feature-review**
- 🔲 `RevisaoDeEstruturaComponent`: `AccessDecisionService.can('imp.confirm')` → `canConfirm`
- 🔲 `RevisaoDeEstruturaComponent`: `AccessDecisionService.can('imp.ignoreFragment')` → `ignoreDisabled`

**Tests**
- 🔲 `nx test imp-feature-review` PASS (sem permissão 'imp.confirm' → botão desabilitado;
  sem permissão 'imp.ignoreFragment' → botão Ignorar oculto)
- 🔲 `nx lint imp-feature-review` PASS

**Milestone:**
Wave 3 / P4 Integrações

**Labels:**
type:integration
layer:frontend
scope:imp
priority:P4

**Acceptance criteria:**
- `AccessDecisionService.can('imp.confirm') === false` → botão confirmar desabilitado
- `AccessDecisionService.can('imp.ignoreFragment') === false` → botão Ignorar oculto
- Grep por `user.role` nos componentes IMP → zero ocorrências

**Dependencies:**
- FE-IMP-016 (ReviewActionsBar — input canConfirm)
- FE-IMP-015 (PendingFragmentRow — input ignoreDisabled)
- FE-IMP-017 (RevisaoDeEstruturaComponent — orchestrador)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum

**Testing / Evidence required:**
- Teste com mock `AccessDecisionService.can` retornando false para cada permissão

**Risks / Notes:**
- Se `AccessDecisionService` ainda não tiver suporte a feature flags (`imp.ignoreFragment`),
  usar `FeatureFlagService` do shared como alternativa e tratar como dois checks distintos.
