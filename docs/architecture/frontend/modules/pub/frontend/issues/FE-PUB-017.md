## [FE-PUB-017] ExportActionsBarComponent — gate podeBaixar, "← Ajustar layout", "⬇ Baixar ePub"

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/pub/ui/src/lib/export-actions-bar/export-actions-bar.component.ts` renderiza a barra de
ações de T07: "← Ajustar layout" (sempre visível, navega para COMP) e "⬇ Baixar ePub" (enabled
iff `podeBaixar === true`; disabled e com tooltip quando erros_criticos ou pendente).

**Context / Problem statement:**
- SPEC-02 §1 define ExportActionsBarComponent: inputs `podeBaixar`, `verdict`; outputs `adjustLayout()`, `baixar()`.
- SPEC-03 §1: `podeBaixar` é um `computed()` no facade — componente nunca computa.
- "Baixar ePub" enabled iff `podeBaixar`; navega T08 via `baixar()` output.
- "← Ajustar layout" sempre disponível; dispara `adjustLayout()` que navega para COMP.

**Approach (execution path):**
1. Criar `libs/pub/ui/src/lib/export-actions-bar/export-actions-bar.component.ts`:
   - `standalone: true`, `OnPush`
   - `input()`: podeBaixar: boolean, verdict: EpubcheckStatus | null
   - `output()`: adjustLayout: OutputEmitterRef, baixar: OutputEmitterRef
   - Botão "⬇ Baixar ePub": `[disabled]="!podeBaixar"`; tooltip quando disabled
   - Botão "← Ajustar layout": sempre habilitado

**Non-goals:**
- Não navega diretamente (responsabilidade do smart component via outputs).
- Não computa podeBaixar (recebe via input).

**Layer(s):**
frontend / libs/pub/ui

**Bounded context:**
pub

**Service execution spec(s):**
- `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-02-component-hierarchy.md` (§1 ExportActionsBarComponent)

**Architecture alignment:**
- Tag Nx: `scope:pub`, `type:ui`
- Standalone + OnPush; zero lógica de negócio

**Implementation checklist (by file):**

**Lib: libs/pub/ui**
- 🔲 `libs/pub/ui/src/lib/export-actions-bar/export-actions-bar.component.ts`
- 🔲 `libs/pub/ui/src/lib/export-actions-bar/export-actions-bar.component.html`
- 🔲 `libs/pub/ui/src/index.ts` (re-exports)

**Tests**
- 🔲 `nx test pub-ui` PASS (podeBaixar=false → botão disabled; podeBaixar=true → baixar emitido)
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
- podeBaixar=false: botão "Baixar ePub" [disabled]; click não emite baixar
- podeBaixar=true: click emite baixar
- adjustLayout emite sempre

**Dependencies:**
- FE-PUB-012 (ExportacaoEValidacaoComponent usa este componente)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum

**Testing / Evidence required:**
- DOM: button[disabled] presente quando podeBaixar=false

**Risks / Notes:**
- Tooltip de "download bloqueado" precisa ser acessível (aria-label).
