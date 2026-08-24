# Module Pattern (Cordelê Frontend)

> **Status:** padrão obrigatório. Fonte canônica da estrutura e da nomenclatura de um módulo FE.

## Vocabulário

A unidade do frontend é o **MÓDULO** (ex.: IMP, COMP, PUB, PROJ).
O scope npm é **`@cordele`** e o esqueleto é gerado pelo plugin Nx local
**`@cordele/internal:module`**. Aqui **só existe `module`** como unidade — sem
conceitos alternativos herdados de projeto-modelo.

| Conceito | Forma canônica |
|---|---|
| unidade | **module** (`<module>`, ex.: `imp`) |
| gerador | **`@cordele/internal:module`** |
| libs compartilhadas | **`@cordele/shared/*`** |
| entry do módulo | `libs/<module>/shell-entry` → importPath **`@cordele/<module>`** (ADR-006) |
| arquivos da entry | `<module>.{module,contract,routes,permission-map,feature-flags,bootstrap,nav.config,descriptor}.ts` |
| registro no Shell | **`module-descriptors.ts`** (`<MODULE>_MODULE_DESCRIPTOR`) |
| campo no generator-config | **`module:`** |

> Em prosa, usar "**módulo**" (pt-BR) ou "module" (en-US técnico).

## Estrutura canônica de um módulo (module slicing)

```
libs/<module>/shell-entry/   (type:app)         # ENTRY como library — importPath @cordele/<module> (ADR-006)
└── src/lib/
    ├── <module>.module.ts                      # único NgModule do módulo
    ├── <module>.contract.ts                    # MODULE_KEY + ModuleMenuMetadata + permissions + flags
    ├── <module>.bootstrap.ts                   # init/destroy lifecycle
    ├── <module>.routes.ts                      # <MODULE>_ROUTES[]
    ├── <module>.permission-map.ts              # ModulePermissionMap
    ├── <module>.feature-flags.ts               # ModuleFeatureFlags (defaultState)
    ├── <module>.nav.config.ts                  # navegação/breadcrumb
    └── <module>.descriptor.ts                  # <MODULE>_MODULE_DESCRIPTOR (consumido pelo Shell)

apps/<module>/             (type:app)           # host fino: app.routes carrega @cordele/<module>
libs/<module>/                                  # libs do módulo
├── access/            (type:domain)            # guards específicos
├── data-access/       (type:data-access)       # *ApiService + facades signals
├── feature-<X>/       (type:feature)           # uma por feature
├── integration/       (type:domain)            # <Module>ShellIntegrationService
├── navigation/        (type:domain)            # breadcrumbs/menu state
├── ui/                (type:ui, opcional)       # componentes locais
└── styles/            (type:ui, opcional)       # CSS de módulo (utilitários Tailwind + tokens; sem SCSS de tokens)

apps/<module>-e2e/                              # Playwright (specs dos .feature)
```

> **Por que a entry é uma library (ADR-006):** o Shell precisa importar o `<module>.descriptor.ts`
> para registrar o módulo, mas apps Nx não importam outros apps. Logo a entry vive numa lib com
> `importPath @cordele/<module>`; `apps/<module>` é só um host fino (`nx serve/build`
> + base do e2e).

Tags Nx: `scope:<module>` + `type:{feature|data-access|domain|ui}` (ver `nx-boundaries.md`).
Regras: standalone + OnPush + Signals; `NgModule` **apenas** no `<module>.module.ts`; módulo só
importa `scope:<module>` + `scope:shared`. HTTP via `@cordele/shared/access-http-base`
(interceptor injeta `X-Empresa-Id`).

## O gerador `@cordele/internal:module`

- **Plugin Nx local:** `frontend/libs/internal-nx-plugin` (npm `@cordele/internal`).
- **Invocação:** `npx nx g @cordele/internal:module --name=<module>`.
- **Document-driven:** lê
  `docs/architecture/frontend/modules/<module>/frontend/frontend-spec/generator-config.yml`
  e deriva: entry lib `libs/<module>/shell-entry` (`@cordele/<module>`) + libs do
  módulo + host `apps/<module>` + `apps/<module>-e2e`. Idempotente. O Shell registra o módulo
  importando `@cordele/<module>`.
- **Gates pós-scaffold:** `nx lint <module>` → `nx test <module>` → `nx build <module>`.

> Pré-condição: as **shared libs** (`@cordele/shared/*`) e o **App Shell**
> (`cordele-web`) precisam existir antes de scaffoldar qualquer módulo — senão o código
> gerado não compila (imports não resolvidos).

## Relação com o backend

O BE usa **scripts Python** (`be-module-generator.py`) para o mesmo papel; o FE usa um **plugin Nx
local** (idiomático ao workspace Angular/Nx). Ambos são document-driven a partir do
`generator-config.yml` do módulo. A unidade conceitual ("MÓDULO") e o prefixo de issue são
compartilhados.

## Referências

- `docs/architecture/frontend/standards/nx-boundaries.md` — tags + direções
- `docs/architecture/frontend/standards/access-layer-contracts.md` — Access Layer
- `docs/architecture/frontend/adr/ADR-006-module-entry-as-library.md` — entry como library
- `CLAUDE.md` — "only MODULE exists" (regra que este doc concretiza no FE)
