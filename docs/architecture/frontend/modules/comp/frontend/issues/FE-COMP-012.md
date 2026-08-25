## [FE-COMP-012] Componentes presentacionais T05 — MetadataFieldComponent, IdiomaSelectComponent, AdvanceBarComponent

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/comp/feature-metadata` contém 3 componentes presentacionais de T05:
`MetadataFieldComponent` (campo genérico com label/error), `IdiomaSelectComponent`
(select pt|en|es|fr) e `AdvanceBarComponent` (botão "Ir para preview" com estado de
loading e disable quando `canAdvance=false`).

**Context / Problem statement:**
- SPEC-02 §1 especifica os 3 presentacionais de T05 com seus inputs/outputs.
- `MetadataFieldComponent` suporta os 4 campos: titulo*, autor*, isbn, categoria.
- `IdiomaSelectComponent` expõe os 4 idiomas; valor default `pt`.
- `AdvanceBarComponent` desabilita o botão enquanto `canAdvance=false` ou `saving=true`.
- Todos são promovidos do protótipo BA ou criados inline se não existirem.

**Approach (execution path):**
1. Criar/promover `MetadataFieldComponent` (input: label, value, required, error?; output: valueChange).
2. Criar/promover `IdiomaSelectComponent` (input: value: MetadadosIdioma; output: change).
3. Criar `AdvanceBarComponent` (input: canAdvance, saving; output: advance).
4. Todos: `standalone: true`, `changeDetection: OnPush`.
5. Remover mock data de qualquer presentacional se existia no protótipo.

**Non-goals:**
- Não implementa `CoverDropZoneComponent` (FE-COMP-013 — lib ui).
- Não conecta à Facade (responsabilidade do smart, FE-COMP-011).

**Layer(s):**
frontend / libs/comp/feature-metadata

**Bounded context:**
comp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-02-component-hierarchy.md` (§1)

**Architecture alignment:**
- Tag Nx: `scope:comp`, `type:feature`
- standalone + OnPush; apenas input()/output() de sinais; sem lógica de negócio

**Implementation checklist (by file):**

**Lib: libs/comp/feature-metadata**
- 🔲 `libs/comp/feature-metadata/src/lib/metadata-field/metadata-field.component.ts`
- 🔲 `libs/comp/feature-metadata/src/lib/idioma-select/idioma-select.component.ts`
- 🔲 `libs/comp/feature-metadata/src/lib/advance-bar/advance-bar.component.ts`

**Tests**
- 🔲 `nx test comp-feature-metadata` PASS
  - AdvanceBarComponent: botão desabilitado quando canAdvance=false
  - IdiomaSelectComponent: emite change no select
- 🔲 `nx lint comp-feature-metadata` PASS

**Milestone:**
Wave 3 / P3 Feature libs

**Labels:**
type:feature
layer:frontend
scope:comp
priority:P3

**Acceptance criteria:**
- `npx nx test comp-feature-metadata` PASS
- `npx nx lint comp-feature-metadata` PASS
- AdvanceBarComponent desabilita botão com `canAdvance=false` ou `saving=true`
- IdiomaSelectComponent lista exatamente pt/en/es/fr

**Dependencies:**
- FE-COMP-011 (feature-metadata routes e smart component)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum (presentacionais puros)

**Testing / Evidence required:**
- Testes de unit: input/output de cada componente; snapshot ou DOM assertions

**Risks / Notes:**
- Verificar se o protótipo tem estes componentes criados ou se estão inline no smart; promover conforme necessário.
