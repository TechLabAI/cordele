## [FE-PROJ-013] ProjectCardComponent + StatusBadgeComponent — badge derivation, libs/proj/ui

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/proj/ui` expõe `ProjectCardComponent` e `StatusBadgeComponent`, usados por ambas as feature-libs
(library e history). `StatusBadgeComponent` aplica a derivação de badge (SPEC-03 §3) e usa
design-token color families — sem `oklch()` inline em produção.

**Context / Problem statement:**
- SPEC-02 §1 define `ProjectCardComponent` e `StatusBadgeComponent` como presentacionais de `libs/proj/ui`.
- A badge é **derivada** no mapper (FE-PROJ-008) e passada como `input(badge: StatusBadgeVM)` ao componente;
  o componente não recomputa — apenas apresenta `tone` e `label`.
- O quick-download button no card é renderizado **só** quando `card.canQuickDownload === true`
  (flag `proj.quickDownload` on + `arquivoUrl != null`) — SPEC-02 §1.
- `StatusBadgeComponent` é compartilhado entre T02 (card library) e T08 (header de histórico).

**Approach (execution path):**
1. Criar `libs/proj/ui/src/lib/project-card/project-card.component.ts` (pres):
   - `input(card: ProjetoCardVM)`.
   - `output(open)`, `output(quickDownload)`.
   - Renderiza: nome, autor (ou placeholder quando `null`/degraded), counters, badge, quick-download (condicional).
   - Usa variáveis CSS de design tokens para cores de status (mapeia `badge.tone` para `var(--proj-badge-{tone}-*)`).
2. Criar `libs/proj/ui/src/lib/status-badge/status-badge.component.ts` (pres):
   - `input(badge: StatusBadgeVM)`.
   - Renderiza ícone Material + label; aplica class CSS pelo `tone`.
3. Promover os estilos do protótipo, substituindo `oklch()` por tokens.
4. Exportar via `index.ts` de `libs/proj/ui`.

**Non-goals:**
- Não implementa a lógica de badge derivation (está no mapper FE-PROJ-008).
- Não implementa o download URL flow (FE-PROJ-016).

**Layer(s):**
frontend / libs/proj/ui

**Bounded context:**
proj

**Service execution spec(s):**
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-02-component-hierarchy.md` (§1, §3)
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-03-view-models.md` (§3)
- `docs/architecture/frontend/modules/proj/frontend/contracts/design-tokens.md`

**Architecture alignment:**
- `standalone: true`, `changeDetection: OnPush`
- `scope:proj`, `type:ui`
- Puramente presentacional: nenhuma injeção de service

**Implementation checklist (by file):**

**Lib: libs/proj/ui**
- 🔲 `libs/proj/ui/src/lib/project-card/project-card.component.ts`
- 🔲 `libs/proj/ui/src/lib/project-card/project-card.component.html`
- 🔲 `libs/proj/ui/src/lib/status-badge/status-badge.component.ts`
- 🔲 `libs/proj/ui/src/lib/status-badge/status-badge.component.html`
- 🔲 `libs/proj/ui/src/index.ts`

**Tests**
- 🔲 `nx test proj-ui` PASS — card com `canQuickDownload=false` não renderiza o botão de download
- 🔲 `nx test proj-ui` PASS — badge `tone='draft'` aplica a class `proj-badge--draft` correta
- 🔲 `nx test proj-ui` PASS — autor `null` → renderiza placeholder (não quebra)
- 🔲 `nx lint proj-ui` PASS

**Milestone:**
Wave 3 / P3 Feature Libraries

**Labels:**
type:feature
layer:frontend
scope:proj
priority:P3

**Acceptance criteria:**
- `npx nx test proj-ui` PASS
- `npx nx lint proj-ui` PASS
- `npx nx build proj-ui` PASS
- 6 tones de badge (`draft`, `progress`, `valid`, `warn`, `error`, `pending`) têm classes CSS distintas
- Nenhuma ocorrência de `oklch(` nos templates de produção

**Dependencies:**
- FE-PROJ-008 (StatusBadgeVM, ProjetoCardVM como tipos de input)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum (puramente presentacional)

**Testing / Evidence required:**
- Testes de renderização condicional: `@if card.canQuickDownload` e `@if badge.tone`
- Screenshot de cada tone de badge para validação visual

**Risks / Notes:**
- Se o protótipo usa `@angular/material` `MatChip` ou `MatIcon`, verificar que estão declarados
  no `standalone: true` imports da lib.
- O design token de cor de badge deve estar em `contracts/design-tokens.md`; se não estiver,
  propor adição antes de commitar o componente.
