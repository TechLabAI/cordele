## [FE-COMP-004] CompShellIntegrationService + COMP_NAV_CONFIG

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/comp/integration/src/lib/comp-shell-integration.service.ts` e
`libs/comp/navigation/src/lib/comp-nav.config.ts` existem e funcionam. O service registra
`COMP_NAV_CONFIG` no `NavigationService` com as posições do step-bar
(Importar › Configurar › Edição › Exportar) e os breadcrumb templates para T05 e T06.

**Context / Problem statement:**
- SPEC-06 §2 especifica `CompShellIntegrationService` e suas responsabilidades.
- `COMP_NAV_CONFIG` define as posições de passo `em_composicao` + breadcrumbs
  `Projetos › {nome} › Configurar` e `Projetos › {nome} › Edição`.
- O service não possui estado de UI; só registra config e emite breadcrumbs de analytics.
- Bloqueia: FE-COMP-003 (bootstrap), FE-COMP-005 (shell registration)

**Approach (execution path):**
1. Criar `libs/comp/navigation/src/lib/comp-nav.config.ts` com `COMP_NAV_CONFIG`: step-bar
   com 4 posições (Importar/Configurar/Edição/Exportar); breadcrumb templates por rota.
2. Criar `CompShellIntegrationService` em `libs/comp/integration`:
   ```ts
   @Injectable({ providedIn: 'root' })
   export class CompShellIntegrationService {
     register(): void { this.nav.registerModuleNav(COMP_NAV_CONFIG); }
   }
   ```
3. Exportar via `index.ts` de cada lib.
4. Adicionar tags Nx corretas (`scope:comp`, `type:domain`).

**Non-goals:**
- Não mantém estado de metadados/layout (só as facades fazem isso — ADR-COMP-001).
- Não emite eventos de analytics além dos breadcrumbs de navegação.

**Layer(s):**
frontend / libs/comp/integration · libs/comp/navigation

**Bounded context:**
comp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-06-shell-integration.md` (§2, §4)

**Architecture alignment:**
- Tag Nx: `scope:comp`, `type:domain` (integration + navigation)
- Importa: `@cordele/shared/access-decision` (NavigationService) e `libs/comp/navigation`
- Não importa libs de outros módulos (IMP/PROJ/PUB)

**Implementation checklist (by file):**

**Lib: libs/comp/navigation**
- 🔲 `libs/comp/navigation/src/lib/comp-nav.config.ts`
- 🔲 `libs/comp/navigation/src/index.ts`
- 🔲 `libs/comp/navigation/project.json` (tags scope:comp, type:domain)

**Lib: libs/comp/integration**
- 🔲 `libs/comp/integration/src/lib/comp-shell-integration.service.ts`
- 🔲 `libs/comp/integration/src/index.ts`
- 🔲 `libs/comp/integration/project.json` (tags scope:comp, type:domain)

**Tests**
- 🔲 `nx test comp-integration` PASS
- 🔲 `nx lint comp-integration` PASS

**Milestone:**
Wave 1 / P1 Foundation

**Labels:**
type:feature
layer:frontend
scope:comp
priority:P1

**Acceptance criteria:**
- `npx nx test comp-integration` PASS
- `npx nx lint comp-integration` PASS
- `CompShellIntegrationService.register()` chama `NavigationService.registerModuleNav` com COMP_NAV_CONFIG
- Boundaries Nx respeitadas (só scope:comp + scope:shared)

**Dependencies:**
- FE-COMP-001 (constantes)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum

**Testing / Evidence required:**
- Spy em `NavigationService.registerModuleNav`; verificar que é chamado com o config correto

**Risks / Notes:**
- Confirmar que `NavigationService` em `@cordele/shared/access-decision` tem o método `registerModuleNav`; se não, alinhar com o time de shared antes de implementar.
