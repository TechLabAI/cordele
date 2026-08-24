# Design Tokens — IMP (Importação)

> IMP uses the **project** design system tokens only (`standards/design-system-tokens.md`,
> `theme.css`). No hard-coded colors, no tool-local token layer. This file lists the tokens the two
> IMP screens consume so the promote phase can verify no literal colors leak in from the prototype.
> Theme is dark (prototype-map `theme: dark`, brand `#00B4A6`, warning `#F59E0B`).

## 1. Tokens consumed by IMP screens

| UI element | Token(s) |
|---|---|
| Page / surfaces | `--color-base`, `--color-surface`, `--color-surface-2`, `--color-elevated` |
| Text | `--color-ink`, `--color-ink-soft`, `--color-ink-faint` |
| Drop zone border / fields | `--color-line`, `--color-line-strong`, `--color-field`, `--color-field-line` |
| Primary CTA ("Importar", "Confirmar") | `--color-brand`, `--color-brand-strong`, `--color-brand-ink`, `--color-brand-subtle` |
| Upload progress bar (fill) | `--color-brand` (determinate) |
| Pending / warning (counter tile, zero-chapters modal) | `--color-warning`, `--color-warning-bg`, `--color-warning-ink` |
| Parse-failed / error banner | `--color-danger`, `--color-danger-bg`, `--color-danger-ink` |
| Success (valid structure) | `--color-success`, `--color-success-bg`, `--color-success-ink` |
| Info banner | `--color-info`, `--color-info-bg`, `--color-info-ink` |
| Step bar (Importar · Configurar · …) | `--color-sidebar*` family / `--color-accent` |
| Typography | `--font-display` (headings), `--font-body` (text), `--text-2xs..4xl`, `--weight-*`, `--leading-*` |
| Radius (cards, drop zone, tiles) | `--radius-card`, `--radius-md`, `--radius-lg` |

## 2. Semantic mapping for IMP states

| IMP state | Tone token family |
|---|---|
| Upload idle / valid file | neutral surfaces + `--color-brand` CTA |
| Uploading (determinate) | `--color-brand` progress fill |
| Parsing (indeterminate "analisando estrutura…") | `--color-brand-subtle` shimmer / `--color-ink-soft` label |
| Pending fragments counter | `--color-warning*` |
| Parse failed / error banner | `--color-danger*` |
| Confirm enabled / structure ready | `--color-success*` accents |

## 3. Rules (from the standard)

- **Never** hard-code a hex/oklch value in a component; always a token. The promote phase must strip
  the prototype's inline colors (e.g. literal `#00B4A6`) and replace with `--color-brand`.
- Beware the `--color-X` / `--text-X` namespace collision (standard §"namespace collision"): do not
  introduce `--color-base` usage where a `--text-base` size is meant.
- Icons via Material Symbols (icon font); the upload glyph is `upload_file` (see SPEC-05 menu icon).
- Fonts are DS tokens (`--font-display`/`--font-body`); the families must match `fonts.html` (derived,
  not copied).
