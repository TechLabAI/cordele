# ADR-006 — Module entry como library (`@cordele/<module>`)

- **Status:** accepted (YYYY-MM-DD)
- **Escopo:** global FE (todos os módulos)
- **Supersede:** ajusta o `module-pattern.md` (a entry deixa de viver em `apps/<module>`)

> ADRs globais FE 001–005 (angular-standalone-signals, nx-boundaries, access-layer,
> lazy-loading, design-tokens) estão **reservados/pendentes**; este é o primeiro ADR global
> materializado.

## Contexto

No padrão de módulo, a *entry* (contract, module, routes, permission-map, feature-flags,
bootstrap, nav.config, descriptor) viveria em `apps/<module>/src/app/<module>-module/`. Ao montar
o **registro de módulos no Shell** (`cordele-web`), surge um bloqueio estrutural:

- O Shell precisa **importar** o `<module>.descriptor.ts` para registrar o módulo (menu, lazy route).
- Mas **apps Nx não importam outros apps** (boundary `@nx/enforce-module-boundaries`) e um app
  **não tem `importPath`** — logo `@cordele/<module>` não existiria e o Shell não
  conseguiria importar a entry.

## Decisão

A **entry do módulo é uma library**: `libs/<module>/shell-entry`, com `importPath`
**`@cordele/<module>`** e tags `scope:<module>` `type:app`. Ela exporta (barrel
`index.ts`) contract + module + routes + permission-map + feature-flags + bootstrap + nav.config +
**`<MODULE>_MODULE_DESCRIPTOR`**.

- O **Shell** (`cordele-web`) importa `@cordele/<module>` em
  `config/module-descriptors.ts` e popula `MODULE_DESCRIPTORS` (boundary `scope:web → scope:<module>`
  é permitido).
- `apps/<module>` permanece como **host fino**: seu `app.routes.ts` apenas
  `loadChildren: () => import('@cordele/<module>').then(m => m.<Module>Module)`.
  Serve de alvo buildável/serveável (`nx serve/build <module>`) e base do web-server do e2e.

## Alternativas consideradas

1. **Manter a entry em `apps/<module>` + lib-ponte só para o descriptor** — rejeitada: mantém um
   app carregando outro, mais indireção, não resolve o `importPath` de forma limpa.
2. **Shell carrega a entry por path relativo a `apps/<module>`** — rejeitada: viola boundary e
   acopla o Shell ao layout de outro app.

## Consequências

- **Positivas:** Shell importa `@cordele/<module>` de forma limpa; registro de
  módulos automatizável pelo gerador; boundaries respeitadas; o módulo é reusável/testável como lib.
- **Negativas:** um app-host fino por módulo (custo pequeno); módulos scaffoldados antes deste ADR
  exigem migração leve da entry `apps/<module>/.../<module>-module` → `libs/<module>/shell-entry`.

## Implementação

- O gerador `@cordele/internal:module` cria `libs/<module>/shell-entry` (importPath
  `@cordele/<module>`), escreve a entry + barrel, e (re)escreve o `app.routes.ts` do
  host `apps/<module>`.
- O Shell registra cada módulo importando `@cordele/<module>` em
  `config/module-descriptors.ts`.
- Gates pós-scaffold: `nx lint <module>` → `nx build <module>` → `nx build/lint cordele-web`.

## Referências

- `docs/architecture/frontend/standards/module-pattern.md`
- `docs/architecture/frontend/standards/nx-boundaries.md`
- `frontend/libs/internal-nx-plugin/internal` — gerador `@cordele/internal:module`
