## [FE-PROJ-011] ProjetoNavigationService — resolver stage-aware, breadcrumbs

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/proj/navigation` expõe `ProjetoNavigationService` com o resolver stage-aware ("Abrir" →
IMP/COMP/history conforme status) e as templates de breadcrumb para as duas rotas. Nenhum componente
embute a lógica de roteamento; toda navegação cross-módulo passa pelo serviço.

**Context / Problem statement:**
- SPEC-01 §2 define as transições de navegação do card "Abrir" em função do `ProjetoStatus`.
- O resolver vive em `libs/proj/navigation` (não no template) — essa é a separação que permite
  testar a lógica sem montar o componente.
- Breadcrumbs: `[Projetos]` na biblioteca, `[Projetos › {nome} › Histórico]` no histórico.
- Usado por `ProjShellIntegrationService.register()` (FE-PROJ-005) e `BibliotecaDeProjetosComponent` (FE-PROJ-012).

**Approach (execution path):**
1. Criar `libs/proj/navigation/src/lib/proj-stage-aware-resolver.ts`:
   - `resolveOpenTarget(status: ProjetoStatus, projetoId: string): string`:
     - `rascunho` → `/imp/upload` (ou `/imp/revisao-de-estrutura/:id` se manuscrito já existe — resolver consulta campo futuro)
     - `em_composicao` → `/comp/config`
     - `publicado|com_erros` → `/projetos/${projetoId}/historico`
     - fallback desconhecido → `/biblioteca-de-projetos`
2. Criar breadcrumb templates:
   - Rota `/biblioteca-de-projetos`: `[{ label: 'Projetos', route: '/biblioteca-de-projetos' }]`
   - Rota `/projetos/:projetoId/historico`: `[{ label: 'Projetos', route: '...' }, { label: '{nome}', dynamic: true }, { label: 'Histórico' }]`
3. Expor `PROJ_NAV_CONFIG` (breadcrumb templates + resolver ref) via `index.ts`.

**Non-goals:**
- Não implementa o `NavigationService` compartilhado (responsabilidade de `@cordele/shared`).
- Não implementa o `empresaGuard` nem o `authGuard`.

**Layer(s):**
frontend / libs/proj/navigation

**Bounded context:**
proj

**Service execution spec(s):**
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-01-route-map.md` (§2)
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-06-shell-integration.md` (§2)

**Architecture alignment:**
- Tag Nx: `scope:proj`, `type:domain`
- Funções puras para o resolver; sem NgModule; sem state

**Implementation checklist (by file):**

**Lib: libs/proj/navigation**
- 🔲 `libs/proj/navigation/src/lib/proj-stage-aware-resolver.ts`
- 🔲 `libs/proj/navigation/src/lib/proj-nav.config.ts` (`PROJ_NAV_CONFIG`)
- 🔲 `libs/proj/navigation/src/index.ts`

**Tests**
- 🔲 `nx test proj-navigation` PASS — `rascunho` → `/imp/upload`
- 🔲 `nx test proj-navigation` PASS — `em_composicao` → `/comp/config`
- 🔲 `nx test proj-navigation` PASS — `publicado` → `/projetos/{id}/historico`
- 🔲 `nx test proj-navigation` PASS — `com_erros` → `/projetos/{id}/historico`
- 🔲 `nx test proj-navigation` PASS — fallback status desconhecido → biblioteca
- 🔲 `nx lint proj-navigation` PASS

**Milestone:**
Wave 2 / P2 Data Access

**Labels:**
type:feature
layer:frontend
scope:proj
priority:P2

**Acceptance criteria:**
- `npx nx test proj-navigation` PASS
- `npx nx lint proj-navigation` PASS
- Todos os 4 status + fallback cobertos (nenhum dead-end)

**Dependencies:**
- FE-PROJ-001 (MODULE_KEY e constantes de rota)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum (navegação client-side apenas)

**Testing / Evidence required:**
- Testes parametrizados: `it.each` ou `describe.each` para cada status

**Risks / Notes:**
- O target exato de IMP para `rascunho` (upload vs revisao-de-estrutura) pode depender de dados
  que o card não carrega; se o campo `manuscritoId` estiver disponível no `ProjetoCardVM`, usar para
  decidir; caso contrário, sempre apontar para `/imp/upload`.
