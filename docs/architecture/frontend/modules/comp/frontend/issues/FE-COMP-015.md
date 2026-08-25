## [FE-COMP-015] StylePanelComponent — painel de estilo com apenas parâmetros honrados pela PUB

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/comp/ui/src/lib/style-panel/style-panel.component.ts` expõe exatamente os 7 parâmetros
da api-contract §7.3: `fonteCorpoFamilia`, `fonteCorpoTamanho`, `espacamentoLinha`,
`margemLateral`, `h1/h2/h3Tamanho`. Nenhum controlo estrutural (sem add/remove page,
sem inserir imagem). Bounds e ordering h1≥h2≥h3 validados pelo componente.

**Context / Problem statement:**
- SPEC-02 §2 e SPEC-05 §5 especificam: o painel expõe EXATAMENTE os parâmetros honrados
  pela PUB (api-contract §7.3); nenhum controlo que a PUB ignoraria.
- `fonteCorpoTamanho`: 12–20; `espacamentoLinha`: 1.2–2.0; `margemLateral`: 10–40;
  `h1/h2/h3Tamanho`: 14–48; enforce `h1 ≥ h2 ≥ h3`.
- Mudanças de estilo emitem `styleChange(param, value)` (sem rede — SPEC-04 §3).
- Controlados pelo `accessGuard('comp.edit')`: sem permissão, painel read-only.

**Approach (execution path):**
1. Criar `StylePanelComponent` em `libs/comp/ui`.
2. input `layout: LayoutParamsVM`, `canEdit: boolean`.
3. output `styleChange: EventEmitter<{param: string, value: unknown}>`.
4. Sliders/selects para os 7 parâmetros com clamp e validação de ordering h1≥h2≥h3.
5. `@if canEdit` wrapping nos controlos mutáveis; read-only display quando não.
6. Sem controlos de page add/remove/insert-image.

**Non-goals:**
- Não persiste dados (responsabilidade da Facade no export).
- Não inclui `ImageAlignmentBadgeComponent` (FE-COMP-017 — no canvas, não no painel).

**Layer(s):**
frontend / libs/comp/ui

**Bounded context:**
comp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-02-component-hierarchy.md` (§2 StylePanelComponent)
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-05-tool-contract.md` (§5)

**Architecture alignment:**
- Tag Nx: `scope:comp`, `type:ui`
- standalone + OnPush; sem lógica de rede

**Implementation checklist (by file):**

**Lib: libs/comp/ui**
- 🔲 `libs/comp/ui/src/lib/style-panel/style-panel.component.ts`
- 🔲 `libs/comp/ui/src/lib/style-panel/style-panel.component.html`

**Tests**
- 🔲 `nx test comp-ui` PASS
  - 7 parâmetros presentes; nenhum controlo de add/remove page
  - `h1Tamanho < h2Tamanho` → emite valor clamped
  - `canEdit=false` → controlos desabilitados
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
- Exatamente 7 parâmetros; sem controlo estrutural
- h1≥h2≥h3 enforçado (teste unitário)

**Dependencies:**
- FE-COMP-014 (feature-layout que usa o painel)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum (presentacional puro)

**Testing / Evidence required:**
- Teste: input layout com valores default → 7 controlos visíveis; h1 < h2 → clamp

**Risks / Notes:**
- Confirmar com api-contract §7.3 os ranges exatos antes de hardcodar nos sliders.
