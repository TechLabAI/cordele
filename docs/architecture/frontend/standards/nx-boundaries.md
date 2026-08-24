# Nx Boundaries (Cordelê)

> **Status:** padrão obrigatório. PR bloqueado se boundaries forem violadas.

Goal: prevenir architecture drift no `frontend/` (Nx + Angular) usando boundaries
enforced por ESLint + `@nx/enforce-module-boundaries`.

---

## Regras de alto nível

- Módulos não importam outros módulos diretamente.
- `frontend/libs/shared/*` é o único caminho aprovado de reuso entre módulos.
- Access Layer (`@cordele/shared/access-decision`, `@cordele/shared/empresa-context`) é
  cross-cutting; decisões de RBAC e contexto de empresa são centralizadas lá.
- Contratos (DTOs, OpenAPI gerados) ficam em `@cordele/shared/contracts` -- evitar
  acoplamento escondido entre módulos.

---

## Modelo de tags

Toda lib/app declara tags no `project.json`. Combinação obrigatória de `type:*` + `scope:*`:

| `type:*` | `scope:*` | Onde aplica |
|---|---|---|
| `type:app` | `scope:web` | `frontend/apps/cordele-web/` |
| `type:e2e` | `scope:web` | `frontend/apps/cordele-web-e2e/` |
| `type:feature` | `scope:<modulo>` | `frontend/libs/<modulo>/feature-*` |
| `type:data-access` | `scope:<modulo>` | `frontend/libs/<modulo>/data-access` |
| `type:ui` | `scope:<modulo>` | `frontend/libs/<modulo>/ui` |
| `type:domain` | `scope:<modulo>` | `frontend/libs/<modulo>/access` |
| `type:ui` | `scope:shared` | `frontend/libs/shared/ui-components`, `ui-tokens`, `ui-feedback` |
| `type:domain` | `scope:shared` | `frontend/libs/shared/access-decision`, `empresa-context`, `auth-session` |
| `type:data-access` | `scope:shared` | `frontend/libs/shared/access-http-base`, `contracts` |

`<modulo>` válidos: `imp`, `comp`, `pub`, `proj`.

---

## Direções permitidas

```
app (scope:web)        -> *                          (pode importar tudo)
feature (scope:<M>)    -> data-access(<M>),
                          ui(<M>),
                          access(<M>),
                          shared/*
data-access (scope:<M>) -> shared/contracts,
                           shared/access-http-base,
                           shared/empresa-context,
                           shared/error-model
ui (scope:<M>)         -> shared/ui-*
access (scope:<M>)     -> shared/access-decision,
                          shared/auth-session
shared/*               -> outros shared/* (sem dep circular)
```

Proibido:
- `scope:<M>` importar `scope:<N>` (M ≠ N) -- **violação dura**
- `shared/*` importar de `scope:<modulo>` -- **violação dura**
- `feature` importar outro `feature` da mesma `scope:<M>` -- evitar (use composição via página)

---

## Configuração ESLint (referência)

`frontend/.eslintrc.json` deve conter:

```json
{
  "rules": {
    "@nx/enforce-module-boundaries": ["error", {
      "depConstraints": [
        { "sourceTag": "scope:imp",  "onlyDependOnLibsWithTags": ["scope:imp",  "scope:shared"] },
        { "sourceTag": "scope:comp",  "onlyDependOnLibsWithTags": ["scope:comp",  "scope:shared"] },
        { "sourceTag": "scope:pub",  "onlyDependOnLibsWithTags": ["scope:pub",  "scope:shared"] },
        { "sourceTag": "scope:proj",  "onlyDependOnLibsWithTags": ["scope:proj",  "scope:shared"] },
        { "sourceTag": "scope:shared", "onlyDependOnLibsWithTags": ["scope:shared"] },
        { "sourceTag": "scope:web",  "onlyDependOnLibsWithTags": ["scope:web", "scope:imp", "scope:comp", "scope:pub", "scope:proj", "scope:shared"] },
        { "sourceTag": "type:feature",     "onlyDependOnLibsWithTags": ["type:feature", "type:data-access", "type:ui", "type:domain"] },
        { "sourceTag": "type:data-access", "onlyDependOnLibsWithTags": ["type:data-access", "type:domain"] },
        { "sourceTag": "type:ui",          "onlyDependOnLibsWithTags": ["type:ui"] },
        { "sourceTag": "type:domain",      "onlyDependOnLibsWithTags": ["type:domain"] }
      ]
    }]
  }
}
```

---

## PR checklist

- [ ] Imports respeitam tags (`@nx/enforce-module-boundaries` verde).
- [ ] Nenhum barrel import que arrasta grafo grande.
- [ ] Rotas lazy preservadas (`loadComponent` ou `loadChildren`).
- [ ] `nx lint`, `nx test`, `nx build` verdes.
- [ ] Sem `../../../` cross-project -- usar path mappings de `tsconfig.base.json`.
