## [FE-IMP-013] UploadComponent (smart) + UploadProgressCard + ImportSubmitButton

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/imp/feature-upload` contém `UploadComponent` (smart, T03) com seus três componentes
presentacionais de estado (`UploadProgressCardComponent`, `ImportSubmitButtonComponent`).
O componente lê signals da `ImportFacade` e navega para T04 ao receber `state === 'done'`.

**Context / Problem statement:**
- SPEC-02 §1 descreve a árvore completa de T03. `UploadComponent` é o smart root que injeta
  `ImportFacade` e `Router`.
- `UploadProgressCardComponent` cobre três fases: `uploading` (barra determinada + progressPct),
  `parsing` (barra indeterminada "analisando estrutura…") e `error` (banner + botão "Reimportar").
- `ImportSubmitButtonComponent` é desabilitado quando `canSubmit === false`.
- Navegação imperative (`Router.navigate`) para `/imp/manuscritos/{manuscritoId}/revisao` após
  `state === 'done'` (efeito derivado de signal, sem polling).
- Bloqueia: FE-IMP-024 (e2e upload)

**Approach (execution path):**
1. Criar `UploadProgressCardComponent` (standalone OnPush):
   - `input() phase`: `'idle'|'uploading'|'parsing'|'done'|'error'`
   - `input() progressPct: Signal<number>` (só relevante em 'uploading')
   - `input() fileName, errorMessage`; `output() retry`
2. Criar `ImportSubmitButtonComponent` (standalone OnPush):
   - `input() disabled, busy`; `output() submit`
3. Criar `UploadComponent` (standalone OnPush):
   - `inject(ImportFacade)`, `inject(Router)`
   - Template usa `ProjectNameFieldComponent`, `ManuscriptDropZoneComponent`,
     `UploadProgressCardComponent`, `ImportSubmitButtonComponent`
   - Efeito `effect(() => { if (facade.state() === 'done') router.navigate(...) })`
   - Tela oculta `UploadProgressCard` quando `state === 'idle'`
   - Dois modos de operação: sem `:projetoId` → `binding.kind='create'` (mostra campo nome);
     com `:projetoId` → `binding.kind='existing'` (oculta campo nome)

**Non-goals:**
- Não implementa `StepBarComponent` (FE-IMP-018).
- Não implementa os guards (FE-IMP-019).

**Layer(s):**
frontend / libs/imp/feature-upload

**Bounded context:**
imp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/SPEC-02-component-hierarchy.md` (§1)
- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/SPEC-03-view-models.md` (§1)

**Architecture alignment:**
- Standalone + OnPush + Signals
- Tag Nx: `scope:imp`, `type:feature`

**Implementation checklist (by file):**

**Lib: libs/imp/feature-upload**
- 🔲 `libs/imp/feature-upload/src/lib/upload.component.ts`
- 🔲 `libs/imp/feature-upload/src/lib/upload.component.html`
- 🔲 `libs/imp/feature-upload/src/lib/components/upload-progress-card/upload-progress-card.component.ts`
- 🔲 `libs/imp/feature-upload/src/lib/components/import-submit-button/import-submit-button.component.ts`
- 🔲 `libs/imp/feature-upload/src/index.ts` (re-export UploadComponent)

**Tests**
- 🔲 `nx test imp-feature-upload` PASS (state=done dispara navigate; state=uploading mostra barra
  determinada; state=parsing mostra barra indeterminada sem progressPct; canSubmit=false desativa botão)
- 🔲 `nx lint imp-feature-upload` PASS

**Milestone:**
Wave 3 / P3 Feature Libs

**Labels:**
type:feature
layer:frontend
scope:imp
priority:P3

**Acceptance criteria:**
- `npx nx test imp-feature-upload` PASS
- `npx nx lint imp-feature-upload` PASS
- `npx nx build imp-feature-upload` PASS
- Fase `parsing` não mostra progressPct numérico
- `state === 'done'` dispara `Router.navigate` para `/imp/manuscritos/{manuscritoId}/revisao`

**Dependencies:**
- FE-IMP-010 (ImportFacade)
- FE-IMP-012 (ProjectNameField, ManuscriptDropZone)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum direto (via facade)

**Testing / Evidence required:**
- Screenshots: estado idle, uploading (barra), parsing (indeterminado), error (banner + Reimportar)

**Risks / Notes:**
- Prototype source: `frontend/design-reference/angular-prototype/apps/cordele-web/src/app/screens/upload/`
  — promover, desconectar mocks, conectar a `ImportFacade`.
