## [FE-COMP-018] StepBarComponent — step bar pipeline Importar › Configurar › Edição › Exportar

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/comp/ui/src/lib/step-bar/step-bar.component.ts` implementa a barra de passos
reutilizável em T05 e T06 com os 4 passos do pipeline (Importar › Configurar › Edição ›
Exportar). Cada passo tem estado `active`, `done` ou `pending`. Reutilizado em ambas as
feature libs de COMP.

**Context / Problem statement:**
- SPEC-02 §1 e §2: `StepBarComponent` (input: `steps: StepVM[]`, `current: 'configurar'|'edicao'`)
  é reusado em T05 e T06.
- `StepVM` = `{ id: string; label: string; state: 'active'|'done'|'pending' }`.
- Step "Configurar" ativo em T05; "Edição" ativo em T06.
- A config vem de `COMP_NAV_CONFIG` (FE-COMP-004), injetada via `StepVM[]` — o componente
  é agnóstico quanto ao conteúdo dos passos.

**Approach (execution path):**
1. Criar `StepBarComponent` em `libs/comp/ui`:
   - input: `steps: StepVM[]`, `current: string`.
   - Computed: `stepsWithState` — marca `active` o passo com id=current; `done` os anteriores; `pending` os posteriores.
2. Criar interface `StepVM` (pode ser em `libs/comp/navigation` ou inline).
3. Exportar via `index.ts`.

**Non-goals:**
- Não implementa navegação entre passos (só visual).
- Não é o step bar global da app (é específico do pipeline COMP).

**Layer(s):**
frontend / libs/comp/ui

**Bounded context:**
comp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-02-component-hierarchy.md` (§1 StepBarComponent)

**Architecture alignment:**
- Tag Nx: `scope:comp`, `type:ui`
- standalone + OnPush

**Implementation checklist (by file):**

**Lib: libs/comp/ui**
- 🔲 `libs/comp/ui/src/lib/step-bar/step-bar.component.ts`
- 🔲 `libs/comp/ui/src/lib/step-bar/step-bar.component.html`

**Tests**
- 🔲 `nx test comp-ui` PASS
  - `current='configurar'` → Configurar ativo; Importar done; Edição/Exportar pending
  - `current='edicao'` → Edição ativo; Importar/Configurar done
- 🔲 `nx lint comp-ui` PASS

**Milestone:**
Wave 3 / P3 Feature libs

**Labels:**
type:feature
layer:frontend
scope:comp
priority:P3

**Acceptance criteria:**
- `npx nx test comp-ui` PASS
- `npx nx lint comp-ui` PASS
- Estados corretos para `current='configurar'` e `current='edicao'`

**Dependencies:**
- FE-COMP-004 (COMP_NAV_CONFIG como source dos StepVMs)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum

**Testing / Evidence required:**
- Teste de estado dos passos para ambos os contextos

**Risks / Notes:**
- Se um StepBarComponent global já existir em `@cordele/shared/ui-layout`, reutilizar e não criar duplicado; verificar antes de implementar.
