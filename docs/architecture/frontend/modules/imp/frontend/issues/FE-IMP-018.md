## [FE-IMP-018] StepBarComponent + IMP_NAV_CONFIG (libs/imp/navigation)

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/imp/navigation/src/lib/` contém `StepBarComponent` (barra de 4 passos do pipeline editorial)
e `IMP_NAV_CONFIG` (configuração de nav do módulo IMP: step 1 "Importar" ativo, steps 2-4 de outros
módulos são contributions externas).

**Context / Problem statement:**
- SPEC-06 §3 descreve o step-bar de 4 passos (Importar · Configurar · Visualizar · Exportar).
  O IMP contribui apenas o step 1; os demais são contribuídos por COMP, PUB via `NavigationService`.
- `StepBarComponent` é usado tanto em T03 quanto em T04 (SPEC-02 §1 e §2).
- Em T03: step 1 ativo (selecionado). Em T04: step 1 completo, step 2 selecionado.
- Bloqueia: FE-IMP-013, FE-IMP-017 (consumidores do StepBar)

**Approach (execution path):**
1. Criar `StepBarComponent` (standalone OnPush) em `libs/imp/navigation`:
   - `input() steps: Signal<StepConfig[]>`, `input() activeIndex: Signal<number>`
   - Renderiza lista horizontal de steps com rótulo, estado (pending/active/complete) e ícones.
2. Criar `IMP_NAV_CONFIG` em `libs/imp/navigation/src/lib/imp.nav-config.ts`:
   - `stepIndex: 1`, `label: 'Importar'`, `route: '/imp/upload'`
   - Compatível com `NavigationService.register` shape.
3. Re-exportar via `libs/imp/navigation/src/index.ts`.
4. `imp.bootstrap.ts` (FE-IMP-003) usa `IMP_NAV_CONFIG` — verificar compatibilidade.

**Non-goals:**
- Não implementa steps 2-4 (pertencem a COMP/PUB).
- Não implementa breadcrumb dinâmico (FE-IMP-020).

**Layer(s):**
frontend / libs/imp/navigation

**Bounded context:**
imp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/SPEC-06-shell-integration.md` (§3)
- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/SPEC-02-component-hierarchy.md` (§1, §2)

**Architecture alignment:**
- Standalone + OnPush + Signals
- Tag Nx: `scope:imp`, `type:domain`

**Implementation checklist (by file):**

**Lib: libs/imp/navigation**
- 🔲 `libs/imp/navigation/src/lib/step-bar/step-bar.component.ts`
- 🔲 `libs/imp/navigation/src/lib/step-bar/step-bar.component.html`
- 🔲 `libs/imp/navigation/src/lib/imp.nav-config.ts`
- 🔲 `libs/imp/navigation/src/index.ts`

**Tests**
- 🔲 `nx test imp-navigation` PASS (StepBar renderiza N steps; activeIndex correto)
- 🔲 `nx lint imp-navigation` PASS

**Milestone:**
Wave 3 / P3 Feature Libs

**Labels:**
type:feature
layer:frontend
scope:imp
priority:P3

**Acceptance criteria:**
- `npx nx test imp-navigation` PASS
- `npx nx lint imp-navigation` PASS
- `npx nx build imp-navigation` PASS
- Step com `activeIndex === 0` renderiza como 'active'
- Step com index menor que `activeIndex` renderiza como 'complete'

**Dependencies:**
- FE-IMP-003 (imp.bootstrap.ts usa IMP_NAV_CONFIG)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum

**Testing / Evidence required:**
- Screenshot do step-bar em T03 (step 1 ativo) e T04 (step 1 completo, step 2 ativo)

**Risks / Notes:**
- Verificar se `@cordele/shared` já tem um componente de step-bar genérico antes de criar novo.
  Se existir, `IMP_NAV_CONFIG` é o que importa; o componente reutiliza o compartilhado.
