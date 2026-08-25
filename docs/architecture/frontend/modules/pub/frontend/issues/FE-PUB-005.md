## [FE-PUB-005] Navigation config — PUB_NAV_CONFIG, StepBarComponent stage 4

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/pub/navigation/src/lib/pub-nav.config.ts` exporta `PUB_NAV_CONFIG` que define
o step-bar "stage 4 — Exportar" e as raízes de breadcrumb `Projetos › {nomeProjeto} › Exportar`.
`StepBarComponent` (`libs/pub/navigation`) é um componente presentational que recebe `steps` e
`activeIndex` e renderiza a barra de 4 etapas (Importar · Configurar · Visualizar · Exportar).

**Context / Problem statement:**
- SPEC-06 §2/§3 e SPEC-02 §1 definem o step-bar: 4 etapas, stage 4 "Exportar" ativa em PUB.
- Steps 1–3 (Importar, Configurar, Visualizar) são contribuídos por IMP/COMP — PUB não os hard-code.
- Breadcrumb: `Projetos › {nomeProjeto} › Exportar` (T07) e `Projetos › {nomeProjeto} › Publicação` (T08).
- Bloqueia: FE-PUB-003 (bootstrap usa PUB_NAV_CONFIG), FE-PUB-012 (T07 usa StepBarComponent)

**Approach (execution path):**
1. Criar `libs/pub/navigation/src/lib/pub-nav.config.ts` com PUB_NAV_CONFIG (stage index, label, breadcrumb roots).
2. Criar `libs/pub/navigation/src/lib/step-bar/step-bar.component.ts`:
   - `standalone: true`, `OnPush`
   - `input()`: steps (string[]), activeIndex (number)
   - Renderiza barra horizontal 4 steps, step ativo destacado
3. Re-exportar via `libs/pub/navigation/src/index.ts`.

**Non-goals:**
- Não implementa os componentes de IMP/COMP/PROJ (steps 1–3 são dados externos).
- Não gerencia navegação imperativa (Router) — só renderização visual.

**Layer(s):**
frontend / libs/pub/navigation

**Bounded context:**
pub

**Service execution spec(s):**
- `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-02-component-hierarchy.md` (§1 StepBarComponent)
- `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-06-shell-integration.md` (§2, §3)

**Architecture alignment:**
- Tag Nx: `scope:pub`, `type:domain`
- Standalone + OnPush; sem HttpClient, sem injeção de serviços

**Implementation checklist (by file):**

**Lib: libs/pub/navigation**
- 🔲 `libs/pub/navigation/src/lib/pub-nav.config.ts`
- 🔲 `libs/pub/navigation/src/lib/step-bar/step-bar.component.ts`
- 🔲 `libs/pub/navigation/src/lib/step-bar/step-bar.component.html`
- 🔲 `libs/pub/navigation/src/index.ts`

**Tests**
- 🔲 `nx test pub-navigation` PASS (StepBarComponent renderiza 4 steps; activeIndex=3 marca Exportar)
- 🔲 `nx lint pub-navigation` PASS

**Milestone:**
Wave 1 / P1 Foundation

**Labels:**
type:feature
layer:frontend
scope:pub
priority:P1

**Acceptance criteria:**
- `npx nx test pub-navigation` PASS
- StepBarComponent com activeIndex=3 renderiza "Exportar" como step ativo
- PUB_NAV_CONFIG.stageIndex === 3

**Dependencies:**
- FE-PUB-001

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum

**Testing / Evidence required:**
- Snapshot/DOM: step ativo tem classe CSS correta; steps inativos não têm

**Risks / Notes:**
- Steps 1–3 são contribuídos por outros módulos via NavigationService; StepBarComponent apenas renderiza o que recebe.
