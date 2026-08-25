## [FE-COMP-023] COMP_NAV_CONFIG breadcrumbs — libs/comp/navigation

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/comp/navigation/src/lib/comp-nav.config.ts` define `COMP_NAV_CONFIG` completo com
os breadcrumb templates para T05 (`Projetos › {nome} › Configurar`) e T06
(`Projetos › {nome} › Edição`), além das posições do step-bar pipeline com os 4 passos.
Breadcrumbs resolvem `{nome}` a partir do projetoId no contexto de rota.

**Context / Problem statement:**
- SPEC-06 §2 especifica que `CompShellIntegrationService.register()` instala `COMP_NAV_CONFIG`
  no `NavigationService`.
- Os breadcrumbs de COMP são dinâmicos: incluem o nome do projeto (`{nome}`) que é resolvido
  da rota ou de um store de PROJ.
- Esta issue concretiza os templates (FE-COMP-004 cria o service que os usa).

**Approach (execution path):**
1. Em `comp-nav.config.ts`, definir `COMP_NAV_CONFIG`:
   ```ts
   { steps: [
       { id: 'importar', label: 'Importar', state: 'done' },
       { id: 'configurar', label: 'Configurar', ... },
       { id: 'edicao', label: 'Edição', ... },
       { id: 'exportar', label: 'Exportar', state: 'pending' },
     ],
     breadcrumbs: {
       'configurar': ['Projetos', '{nome}', 'Configurar'],
       'edicao': ['Projetos', '{nome}', 'Edição'],
     }
   }
   ```
2. Definir como os `{nome}` são resolvidos (placeholder ou via resolver de rota).
3. Exportar via `index.ts`.

**Non-goals:**
- Não implementa `NavigationService` (shared).
- Não altera a lógica de resolução de breadcrumbs no shared.

**Layer(s):**
frontend / libs/comp/navigation

**Bounded context:**
comp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-06-shell-integration.md` (§2)
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-01-route-map.md` (§1 Breadcrumb)

**Architecture alignment:**
- Tag Nx: `scope:comp`, `type:domain`

**Implementation checklist (by file):**

**Lib: libs/comp/navigation**
- 🔲 `libs/comp/navigation/src/lib/comp-nav.config.ts` (atualizado com breadcrumbs completos)

**Tests**
- 🔲 `nx test comp-navigation` PASS — COMP_NAV_CONFIG tem 4 steps e 2 breadcrumb templates
- 🔲 `nx lint comp-navigation` PASS

**Milestone:**
Wave 6 / P6 Navigation

**Labels:**
type:feature
layer:frontend
scope:comp
priority:P6

**Acceptance criteria:**
- `npx nx test comp-navigation` PASS
- 4 steps definidos com ids corretos
- 2 breadcrumb templates (configurar, edicao)

**Dependencies:**
- FE-COMP-004 (CompShellIntegrationService que usa esta config)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum

**Testing / Evidence required:**
- Teste: COMP_NAV_CONFIG.steps.length === 4; breadcrumbs['configurar'] definido

**Risks / Notes:**
- A resolução dinâmica de `{nome}` pode requerer um RouteResolver ou acesso ao ProjetoStore — verificar o contrato do NavigationService antes de implementar.
