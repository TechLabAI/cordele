# Asset-Driven UI (Cordelê)

> Construir UI como **assets reusáveis** em vez de telas one-off.

Goal: garantir que cada entrega de UI produza **building blocks** que outros módulos
podem reusar, em vez de duplicar componentes.

---

## Definições

- **Asset:** building block reusável (componente, padrão de tela, ApiService, contrato)
  consumido por múltiplos módulos.
- **Pattern:** composição reusável (wizard, smart table, approval widget, timeline).
  Em Cordelê, os 7 padrões P1-P7 do protótipo (`prototipo-padroes-telas`) já catalogam
  os mais comuns.
- **Módulo UI:** UI domain-specific de um único módulo (`cad`, `com`, `fis`, ...).

---

## Regra de decisão: onde colocar?

**Promover para `frontend/libs/shared/*` quando:**
- repete entre módulos OU provavelmente vai repetir
- é domain-agnostic (não fala sobre cliente, NFe, estoque, etc.)
- oferece aceleração mensurável (reduz trabalho futuro)

**Manter em `frontend/libs/<modulo>/ui/` quando:**
- é domain-specific (formulários, cards, listas de domínio específico)
- depende de tipos / contratos só daquele módulo

---

## Modelo de composição UI

- `frontend/apps/cordele-web/` provê layout (topbar, sidebar, content slot, right panel)
  e UX global (loading, error, no-access).
- Módulos renderizam no Content slot via `<router-outlet>` (lazy routes).
- Tokens de design vivem em `theme.css` (`@theme`, oklch — Tailwind v4 CSS-first);
  ver `standards/design-system-tokens.md`. Estilo = utilitários Tailwind + tokens.
- `@cordele/shared/ui-*` provê:
  - componentes base (CDK + utilitários Tailwind: button, input, card, badge)
  - patterns (timeline, wizard, table, empty/loading/error states em `ui-feedback`)

---

## Expectativas de performance

- **Lazy-first:** módulos NÃO inflam o bundle crítico do `cordele-web`.
- **Listas grandes:** virtual scroll (`@angular/cdk/scrolling`) ou paginação obrigatória.
- **Evitar trabalho pesado em template:** empurrar lógica para services/facades.
- **Imagens:** lazy load + dimensões definidas (evita layout shift).

---

## Outputs esperados (o que "done" significa)

- O módulo funciona end-to-end.
- Pedaços reutilizáveis foram promovidos a `@cordele/shared/*`.
- Padrão usado documentado (link para `prototipo-padroes-telas` se aplicável).
- Lint, test e build verdes (`nx lint <project>`, `nx test <project>`, `nx build <project>`).

---

## Mapeamento padrão protótipo → asset reusável

| Padrão protótipo (P1-P7) | Asset equivalente em Cordelê |
|---|---|
| P1 GenericCRUDScreen | `@cordele/shared/ui-components/generic-crud-page` (utilitários Tailwind) |
| P2 Tabbed Detail | `@cordele/shared/ui-components/tabbed-detail-panel` |
| P3 ExpandableList | `@cordele/shared/ui-components/expandable-list` |
| P4 KPI + Lista | composição (`@cordele/shared/ui-components/kpi-grid` + `data-table`) |
| P5 Tree | `@angular/cdk/tree` + wrapper em `@cordele/shared/ui-components/tree-editor` |
| P6 Kanban | `@angular/cdk/drag-drop` + wrapper em `@cordele/shared/ui-components/kanban-board` |
| P7 PipelineEditor | módulo-específico de CRM (`@cordele/crm/feature-pipeline-editor`) |
