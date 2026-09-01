## [FE-IMP-015] Componentes T04 — ChapterToc, PendingFragmentRow, PendingFragmentsPanel

**Status:** ✅ COMPLETA (P4 validação 2026-08-31T17:50Z)
**GitHub:** [#TBD]

**Outcome:**
`libs/imp/feature-review/src/lib/components/` contém `ChapterTocComponent`,
`PendingFragmentRowComponent` e `PendingFragmentsPanelComponent` — cobrindo a listagem de
capítulos (colapsável) e o painel de pendências (trechos não-parseados) de T04.

**Context / Problem statement:**
- SPEC-02 §2 define estes três componentes como presentacionais.
- `PendingFragmentsPanelComponent` deve SEMPRE renderizar todos os trechos não-parseados — nunca
  ocultar ou auto-dismiss (critério `imp-pending-always`).
- `PendingFragmentRowComponent` emite `ignore(id)` e `viewDetails(id)` — a ação de ignorar
  é controlada pelo feature flag `imp.ignoreFragment` (o UploadComponent/RevisaoDeEstruturaComponent
  passa o `disabled` quando a flag está off).
- O label de cada `TrechoVM.tipo/descricao` usa a mapping table SPEC-03 §4; `reason` desconhecido →
  "Não classificado" (critério `imp-reason-fallback`).
- Bloqueia: FE-IMP-017 (RevisaoDeEstruturaComponent)

**Approach (execution path):**
1. Criar `ChapterTocComponent` (standalone OnPush):
   - `input() capitulos: Signal<CapituloVM[]>`, `input() expanded: Signal<boolean>`
   - Lista colapsável com "partial + +N mais"; `output() toggleExpand`.
2. Criar `PendingFragmentRowComponent` (standalone OnPush):
   - `input() trecho: Signal<TrechoVM>`
   - Exibe tipo, descricao, pagina, capitulo; botão "Ignorar" (oculto quando `ignoreDisabled`);
     `output() ignore(id)`, `output() viewDetails(id)`.
3. Criar `PendingFragmentsPanelComponent` (standalone OnPush):
   - `input() pendencias: Signal<TrechoVM[]>`, `input() ignoreDisabled: Signal<boolean>`
   - Renderiza `PendingFragmentRowComponent ×N` — nunca filtra, nunca oculta.
4. Mapeamento de `reason` → `tipo`+`descricao` pode ser um pipe puro `ReasonLabelPipe`
   (SPEC-03 §4; fallback `other`).

**Non-goals:**
- Não implementa `ReviewActionsBarComponent` (FE-IMP-016).

**Layer(s):**
frontend / libs/imp/feature-review

**Bounded context:**
imp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/SPEC-02-component-hierarchy.md` (§2)
- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/SPEC-03-view-models.md` (§3, §4)

**Architecture alignment:**
- Standalone + OnPush + Signals
- Tag Nx: `scope:imp`, `type:feature`

**Implementation checklist (by file):**

**Lib: libs/imp/feature-review**
- 🔲 `libs/imp/feature-review/src/lib/components/chapter-toc/chapter-toc.component.ts`
- 🔲 `libs/imp/feature-review/src/lib/components/pending-fragment-row/pending-fragment-row.component.ts`
- 🔲 `libs/imp/feature-review/src/lib/components/pending-fragments-panel/pending-fragments-panel.component.ts`
- 🔲 `libs/imp/feature-review/src/lib/pipes/reason-label.pipe.ts`

**Tests**
- 🔲 `nx test imp-feature-review` PASS:
  - PendingFragmentsPanel renderiza todos os trechos (nunca filtra)
  - ReasonLabelPipe: `complex_table` → "Tabela complexa"; unknown → "Não classificado"
  - Botão "Ignorar" oculto quando `ignoreDisabled=true`
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
- Painel renderiza N trechos para N pendências (não filtra)
- Reason desconhecido → "Não classificado"

**Dependencies:**
- FE-IMP-006 (TrechoVM interface)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum

**Testing / Evidence required:**
- Teste unitário de `ReasonLabelPipe` com todos os 7 reasons + fallback

**Risks / Notes:**
- `PendingFragmentRowComponent` deve emitir `ignore(id)` mesmo quando trecho já está `ignorado=true`
  (para o UI mostrar estado mas o botão ainda pode ser pressionado para un-ignore — checar com UX).
