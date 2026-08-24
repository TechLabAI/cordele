## [FE-IMP-020] Breadcrumb dinâmico — títulos de rota com projetoId/nomeArquivo

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
As rotas de IMP exibem breadcrumbs dinâmicos corretos: `Projetos › {nomeProjeto} › Importar` para a
rota de projeto existente e `Projetos › {nomeProjeto} › Estrutura` para T04, resolvendo o nome a
partir do contexto de navigation state ou do manuscrito hydratado.

**Context / Problem statement:**
- SPEC-01 §1 define os breadcrumbs de cada rota; os dinâmicos requerem `{nomeProjeto}` que não está
  na URL — vem do response do upload ou do manuscrito.
- `NavigationService` (via `ImpShellIntegrationService`, SPEC-06 §2) deve ser notificado do título
  dinâmico após hydrate de T04.
- Rota plana `/imp/upload` tem breadcrumb fixo `Projetos › Novo projeto › Importar`.

**Approach (execution path):**
1. Em `UploadComponent` (FE-IMP-013): após `state === 'done'`, antes de navegar para T04,
   chamar `NavigationService.setBreadcrumb({ label: nomeProjeto, route: '/projetos' })` se disponível.
2. Em `RevisaoDeEstruturaComponent` (FE-IMP-017): após hydrate (`status === 'ready'`), atualizar
   breadcrumb com `manuscrito.nomeArquivo` via `NavigationService`.
3. Se `NavigationService.setBreadcrumb` não existir no shared, usar `Title` service do Angular como
   fallback (atualizar `<title>` com o nome do arquivo).
4. Breadcrumb de rota estática fica em `data.breadcrumb` da rota (FE-IMP-002 — já colocado na issue
   de rotas).

**Non-goals:**
- Não cria serviço de breadcrumb novo (usa `NavigationService` existente ou fallback).
- Não implementa breadcrumb visual (componente shell).

**Layer(s):**
frontend / libs/imp/feature-upload, libs/imp/feature-review

**Bounded context:**
imp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/SPEC-01-route-map.md` (§1)
- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/SPEC-06-shell-integration.md` (§2)

**Architecture alignment:**
- Tag Nx: `scope:imp`, `type:domain`

**Implementation checklist (by file):**

**Libs: imp/feature-upload + imp/feature-review**
- 🔲 `UploadComponent` — chamar NavigationService.setBreadcrumb após upload done
- 🔲 `RevisaoDeEstruturaComponent` — atualizar breadcrumb após status='ready'

**Tests**
- 🔲 `nx test imp-feature-review` PASS (breadcrumb atualizado com nomeArquivo após hydrate)
- 🔲 `nx lint imp-feature-review` PASS

**Milestone:**
Wave 4 / P6 Navigation

**Labels:**
type:feature
layer:frontend
scope:imp
priority:P6

**Acceptance criteria:**
- `npx nx test imp-feature-review` PASS
- `npx nx lint imp-feature-review` PASS
- Breadcrumb exibe `{nomeArquivo}` em T04 após hydrate
- Breadcrumb de `/imp/upload` é fixo

**Dependencies:**
- FE-IMP-013 (UploadComponent)
- FE-IMP-017 (RevisaoDeEstruturaComponent)
- INT-FE-IMP-006 (NavigationService via ImpShellIntegrationService)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum

**Testing / Evidence required:**
- Spy em NavigationService.setBreadcrumb confirmando chamada com nome correto

**Risks / Notes:**
- Se o Shell não tiver `NavigationService.setBreadcrumb` ainda, usar Angular `Title` como
  fallback e adicionar uma issue de acompanhamento para o shared.
