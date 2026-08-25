# Design Tokens — PROJ (Projetos)

> PROJ uses the **project** design system tokens only (`standards/design-system-tokens.md`,
> `theme.css`). No hard-coded colors, no module-local token layer. This file lists the tokens the two
> PROJ screens consume so the promote phase can strip the prototype's inline `oklch(...)` and verify no
> literal colors leak in (doc 06 R4). The two prototype screens
> (`biblioteca-de-projetos`, `download-e-historico`) currently use CSS custom properties **plus** inline
> `oklch(...)` for status colours — the latter must move to the token utilities below at Promote.

## 1. Tokens consumed by PROJ screens (already token-based in the prototype)

| UI element | Token(s) |
|---|---|
| Page width / layout | `--content-max-width` |
| Surfaces / background | `--bg-base`, `--bg-surface`, `--bg-surface-hover`, `--bg-surface-active` |
| Text | `--text-primary`, `--text-secondary`, `--text-tertiary`, `--text-on-brand` |
| Borders | `--border-subtle`, `--border-default` |
| Elevation | `--shadow-sm` |
| Primary CTA ("Novo projeto", "Nova exportação", "Abrir") | `--color-brand`, `--text-on-brand`, `--color-brand-subtle` |
| Error text (row `erros`) | `--color-error-ink` |
| Typography | `--font-display` (headings), body font, size/weight utilities |
| Radius | card / button radii (`rounded-lg`, `rounded-xl` → token radii at Promote) |

## 2. Status / badge colours to migrate off inline `oklch(...)`

The prototype hard-codes badge and status-icon colours as inline `oklch(...)` (T02 `badgeStyle`,
`cardAccent`; T08 `statusColor`, `statusBg`). Promote maps them to token families keyed by the derived
`StatusBadgeVM.tone` (SPEC-03):

| `tone` (badge/status) | Prototype `oklch` (to remove) | Target token family |
|---|---|---|
| `draft` (Rascunho) | `oklch(78% 0.16 75 …)` (amber) | `--color-warning*` (draft/neutral variant) |
| `progress` (Em andamento) | `oklch(58% 0.19 245 …)` (blue) | `--color-info*` / `--color-accent*` |
| `valid` (Válido) | `oklch(58% 0.18 145 …)` (green) | `--color-success*` |
| `warn` (avisos) | `oklch(58% 0.18 145 …)` (green) | `--color-success*` (with warning count label) |
| `error` (Erros / erros_criticos) | `oklch(52% 0.23 25 …)` (red) | `--color-danger*` |
| `pending` (Pendente) | `--bg-surface-active` / `--text-tertiary` | neutral surface family |

## 3. Semantic mapping for PROJ states

| PROJ state | Tone token family |
|---|---|
| Library card — rascunho / em_composicao | `draft` / `progress` badge tone |
| Library card — published (valid/warn/error) | folds `ultimoEpubcheckStatus` → success/danger tone |
| Empty library | neutral dashed surface + `--color-brand` CTA |
| History row — valid/warn | `--color-success*` icon + downloadable |
| History row — erros_criticos | `--color-danger*` icon + non-downloadable marker |
| History row — pendente | neutral surface + non-downloadable marker |
| "versão atual" chip | `--color-brand-subtle` + `--color-brand` |
| Error / degraded feedback | `--color-danger*` (error) / subtle neutral (degraded field marker) |

## 4. Theme

Dark design system (custom `theme.css`); brand teal per the prototype. No SCSS token layer; colours are
CSS custom properties + Tailwind utilities. Promote MUST leave **zero** literal `oklch(...)`/hex in the
promoted `libs/proj/*` components — all colour flows through the tokens above.
