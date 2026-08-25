# Design Tokens — PUB (Publicação)

> PUB uses the **project** design system tokens only (`standards/design-system-tokens.md`,
> `theme.css`). No hard-coded colors, no tool-local token layer. This file lists the tokens the two
> PUB screens consume so the promote phase can verify no literal colors leak in from the prototype
> (the prototype uses inline `oklch(...)`/`style="..."` for the result banners — these must move to
> tokens). Theme is dark (brand `#00B4A6`, warning `#F59E0B`).

## 1. Tokens consumed by PUB screens

| UI element | Token(s) |
|---|---|
| Page / surfaces | `--color-base`, `--color-surface`, `--color-surface-2`, `--color-elevated` |
| Text | `--color-ink`, `--color-ink-soft`, `--color-ink-faint` |
| Cards / lines (history rows, result card, KPI tiles) | `--color-line`, `--color-line-strong` |
| Primary CTA ("Baixar ePub", "Nova exportação") | `--color-brand`, `--color-brand-strong`, `--color-brand-ink`, `--color-brand-subtle` |
| Generating indicator (indeterminate) | `--color-brand-subtle` shimmer / `--color-ink-soft` label |
| **Válido** result banner (success) | `--color-success`, `--color-success-bg`, `--color-success-ink` |
| **Avisos** non-blocking (warning caveat, `<details>`) | `--color-warning`, `--color-warning-bg`, `--color-warning-ink` |
| **Erros críticos** result banner + blocked download | `--color-danger`, `--color-danger-bg`, `--color-danger-ink` |
| Info / neutral hints (empty history state) | `--color-info`, `--color-info-bg`, `--color-info-ink` |
| "Publicado" status chip (T08 header) | `--color-success*` / `--color-brand*` (per chip tone) |
| Step bar (Importar · Configurar · Visualizar · Exportar) | `--color-sidebar*` family / `--color-accent` |
| Typography | `--font-display` (headings), `--font-body` (text), `--text-2xs..4xl`, `--weight-*`, `--leading-*` |
| Radius (cards, tiles, banners) | `--radius-card`, `--radius-md`, `--radius-lg` |

## 2. Semantic mapping for PUB states

| PUB state | Tone token family |
|---|---|
| Gerando (indeterminate "Gerando seu ePub…") | `--color-brand-subtle` shimmer / `--color-ink-soft` label |
| Válido (0 erros) — downloadable | `--color-success*` banner + `--color-brand` "Baixar ePub" CTA |
| Avisos (não bloqueantes) — downloadable | `--color-success*` banner with `--color-warning*` caveat/`<details>` |
| Erros críticos — download bloqueado | `--color-danger*` banner; download control disabled/"inválido" |
| Histórico: linha válida | `--color-success*` status icon + `--color-brand` "Baixar" |
| Histórico: linha inválida (erros críticos) | `--color-danger*` status icon + disabled "inválido" |
| Request/network error | `--color-danger*` banner + `--color-brand` "Tentar novamente" |

## 3. Rules (from the standard)

- **Never** hard-code a hex/oklch value in a component; always a token. The promote phase must strip
  the prototype's inline colors (e.g. literal `#00B4A6`, `oklch(...)` result banners) and replace with
  the semantic `--color-{success,warning,danger}*` tokens above — the válido/avisos/erros banners are
  the load-bearing case.
- Beware the `--color-X` / `--text-X` namespace collision (standard §"namespace collision"): do not
  introduce `--color-base` usage where a `--text-base` size is meant.
- Icons via Material Symbols (icon font); the menu/CTA glyph is `publish` (see SPEC-05 menu icon);
  download uses `download`, warning `warning`, error `error`, success `check_circle`.
- Fonts are DS tokens (`--font-display`/`--font-body`); the families must match `fonts.html` (derived,
  not copied).
- Layout must reserve space for the `gerando → result` banner swap so the transition does not shift the
  page (CLS < 0.1, doc 01 success signal).
