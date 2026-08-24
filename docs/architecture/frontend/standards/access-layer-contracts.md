# Access Layer Contracts (Cordelê)

> Sessão / Empresa-Context / Decisão de Acesso / Navegação -- APIs cross-cutting do frontend.

Goal: prover APIs deterministas, reusáveis e cross-cutting para o app `cordele-web` e
todos os módulos. Toda decisão de autorização e navegação passa por esta camada.

Localização: `frontend/libs/shared/` (subdivido em libs especializadas).

---

## Responsabilidades

| Service / Lib | Responsabilidade |
|---|---|
| `@cordele/shared/auth-session` (`AuthSessionService`) | Estado da sessão do usuário (claims do JWT, roles, expiry). Login/logout via OIDC contra `iam-service`. |
| `@cordele/shared/empresa-context` (`EmpresaContextService`) | Empresa ativo do contexto atual + signal reativo de troca. |
| `@cordele/shared/access-decision` (`PermissionService` + `AccessDecisionService`) | Avalia permissões / feature flags. Produz: allow/deny, capabilities, visibilidade de menu/rota. |
| `@cordele/shared/access-decision` (`NavigationService`) | Deriva árvore de menu / breadcrumb a partir das decisões. |
| `@cordele/shared/access-http-base` | `HttpClient` wrapper + interceptors (Correlation, X-Empresa-Id, ErrorNormalize). |

---

## Não-responsabilidades (hard boundary)

- **Componentes de UI não avaliam permissões diretamente.** Sempre via `AccessDecisionService.can(<perm>)`.
- **Módulos não implementam fluxos de auth** nem armazenam sessão em paralelo.
- **`app.routes.ts` não constrói menu ad-hoc.** Consome saídas de `NavigationService`.
- **Components não chamam `HttpClient` direto** -- só via `<Resource>ApiService` (`data-access`).

---

## Regras de integração

- Módulos consomem Access Layer através de fachadas estáveis (`@cordele/shared/*`).
- A troca de empresa via `EmpresaContextService.switchTo(empresaId)`:
  - cancela in-flight requests escopados ao empresa anterior
  - invalida caches escopados explicitamente
  - re-avalia decisões de acesso e navegação
  - atualiza UI sem refresh completo
- Decisões de acesso permanecem na Access Layer -- nunca duplicadas em features.

---

## Checks de aceite

- [ ] Zero `HttpClient` direto dentro de componentes (`*.component.ts`).
- [ ] Zero `if (user.role === 'admin')` ou similar espalhados em features.
- [ ] Guards (`authGuard`, `empresaGuard`, `accessGuard(<perm>)`) usam outputs de `AccessDecisionService`.
- [ ] Renderização de menu / habilitação de ações usa `NavigationService` ou `AccessDecisionService`.
- [ ] Zero leitura direta de `localStorage`/`sessionStorage` -- via `@cordele/shared/auth-session`.
- [ ] Toda chamada HTTP passa pelo interceptor de `@cordele/shared/access-http-base` (header `X-Empresa-Id` automático).

---

## Multi-empresa (alinhamento com `shared/multi-empresa.md`)

- O `EmpresaContextService` é a única fonte de verdade do `empresaId` ativo no frontend.
- Componentes consomem via signal: `currentEmpresa = this.empresaContext.current()`.
- Nunca ler `empresaId` direto do JWT decodificado -- sempre via `EmpresaContextService`.
