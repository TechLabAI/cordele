# Design Tokens — COMP (Composição)

> COMP uses the **project** design system tokens only (`standards/design-system-tokens.md`, `theme.css`).
> No hard-coded colours, no module-local token layer. This file lists the tokens the two COMP screens consume
> so the promote phase can strip the prototype's inline `oklch(...)` / `style="…"` literals and verify no
> literal colours leak in (doc 02 §5). The two prototype screens (`configuracoes`, `editor-de-layout-preview`)
> currently mix CSS custom properties **with** inline `oklch(...)` (step-bar accent, slider value chips,
> alignment badge) — the latter must move to the token utilities below at Promote.

## 1. Tokens consumed by COMP screens

| UI element | Token(s) |
|---|---|
| Page width / layout | `--content-max-width` |
| Surfaces / background | `--bg-base`, `--bg-surface`, `--bg-surface-hover`, `--bg-surface-active` |
| Text | `--text-primary`, `--text-secondary`, `--text-tertiary`, `--text-on-brand` |
| Borders | `--border-subtle`, `--border-default`, `--border-strong` |
| Form fields (T05 inputs, T06 selects) | `--bg-surface`, `--border-default`, focus ring `--color-brand` |
| Required-field / validation marks | `--color-error`, `--color-error-ink` |
| Primary CTA ("Ir para preview", "Exportar") | `--color-brand`, `--text-on-brand`, `--color-brand-subtle` |
| Step bar (Importar › Configurar › Edição › Exportar) | active `--color-brand`, done `--color-success`, pending `--text-tertiary` + `--border-strong` |
| Slider value chips (fonte, espaçamento, headings, margem) | `--color-brand` on `--color-brand-subtle` |
| Image-alignment badge (T06) | `--color-brand-subtle` + `--color-brand` |
| Typography | `--font-display` (headings), `--font-body` (body), size/weight utilities |
| Radius | field / button / card radii (`rounded-lg`, `rounded-xl` → token radii at Promote) |

## 2. The preview "paper" surface (deliberate light island)

The T06 preview canvas simulates the **printed page**, not the app UI: it renders on a light "paper" surface
regardless of the dark app chrome (doc 02 §5). At Promote this uses the dedicated paper tokens rather than
`--bg-*` app-surface tokens:

| Preview element | Token(s) |
|---|---|
| Paper sheet | `--paper-bg` (light), `--paper-ink` (dark text) |
| Body text on paper | `--paper-ink`, family = `fonteCorpoFamilia` (serif → Georgia; sans → `--font-body`) |
| Headings on paper | `--paper-ink`, sizes from `h1/h2/h3Tamanho` params |
| Blank-page placeholder (deferred, not wired) | neutral `--paper-muted` (only if the structural path is enabled post-POC) |

The paper values are the one place COMP deliberately does **not** follow the dark app surface tokens — they are
still tokens, not literals.

## 3. Status / feedback colours to migrate off inline `oklch(...)`

The prototype hard-codes a few accents as inline `oklch(...)`. Promote maps them to token families:

| UI accent (prototype inline) | Prototype `oklch` (to remove) | Target token family |
|---|---|---|
| Step-bar "current" accent | `oklch(42% 0.20 245 …)` / `oklch(58% 0.19 245 …)` (blue) | `--color-brand*` |
| Slider value chip background | `oklch(58% 0.19 245 / 0.10)` | `--color-brand-subtle` |
| Required-field asterisk | `var(--color-error)` (already token) | `--color-error` |
| Alignment badge | brand-tinted inline | `--color-brand-subtle` + `--color-brand` |
| Cover drop-zone error (413/415) | inline red | `--color-danger*` |

## 4. Theme

Dark design system (custom `theme.css`); brand teal per the prototype. No SCSS token layer; colours are CSS
custom properties + Tailwind utilities. Promote MUST leave **zero** literal `oklch(...)`/hex in the promoted
`libs/comp/*` components — all colour flows through the tokens above, the sole intentional exception being the
`--paper-*` family that gives the preview its light page surface.
