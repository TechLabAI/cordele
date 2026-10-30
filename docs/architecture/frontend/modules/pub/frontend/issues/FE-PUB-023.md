## [FE-PUB-023] Breadcrumb state — PUB_NAV_CONFIG, barra 4 etapas integrada ao NavigationService

**Status:** ✅ DONE
**GitHub:** [#TBD]

**Outcome:**
`libs/pub/navigation` registra as contribuições de breadcrumb de PUB via `NavigationService` do Shell
(invocado por pub.bootstrap `init`): `Projetos › {nomeProjeto} › Exportar` para T07 e
`Projetos › {nomeProjeto} › Publicação` para T08. A barra de 4 etapas (Importar · Configurar ·
Visualizar · Exportar) usa `PUB_NAV_CONFIG` com `stageIndex=3`.

**Context / Problem statement:**
- SPEC-06 §2/§3: PubShellIntegrationService registra PUB_NAV_CONFIG no init.
- Breadcrumb dinâmico: `{nomeProjeto}` vem do projeto carregado (HistoryFacade/ExportFacade).
- Steps 1–3 são contribuídos por IMP/COMP; PUB contribui apenas o step 4.
- SPEC-02 §1: StepBarComponent recebe `steps` e `activeIndex` (3 = Exportar).

**Approach (execution path):**
1. Completar `PUB_NAV_CONFIG` em `libs/pub/navigation/src/lib/pub-nav.config.ts`:
   - `stageIndex: 3`, `stageLabel: 'Exportar'`
   - Breadcrumb roots para T07 e T08 (template com `{nomeProjeto}`)
2. Validar que `init()` em pub.bootstrap chama `ctx.nav.register(PUB_NAV_CONFIG)`.
3. Validar que os breadcrumb roots estão corretos por rota (T07 vs T08).

**Non-goals:**
- Não implementa NavigationService (pertence ao shared Shell).
- Não gerencia breadcrumbs de outros módulos.

**Layer(s):**
frontend / libs/pub/navigation

**Bounded context:**
pub

**Service execution spec(s):**
- `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-06-shell-integration.md` (§2, §3)

**Architecture alignment:**
- Tag Nx: `scope:pub`, `type:domain`

**Implementation checklist (by file):**

**Lib: libs/pub/navigation**
- 🔲 `libs/pub/navigation/src/lib/pub-nav.config.ts` (PUB_NAV_CONFIG completo)
- 🔲 Validar wiring em pub.bootstrap.ts (FE-PUB-003)

**Tests**
- 🔲 `nx test pub-navigation` PASS (PUB_NAV_CONFIG.stageIndex === 3; breadcrumb roots por rota)
- 🔲 `nx lint pub-navigation` PASS

**Milestone:**
Wave 6 / P6 Navigation

**Labels:**
type:feature
layer:frontend
scope:pub
priority:P6

**Acceptance criteria:**
- PUB_NAV_CONFIG.stageIndex === 3
- Breadcrumb T07: "Projetos › {nomeProjeto} › Exportar"
- Breadcrumb T08: "Projetos › {nomeProjeto} › Publicação"

**Dependencies:**
- FE-PUB-003 (bootstrap), FE-PUB-005 (StepBarComponent)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum

**Testing / Evidence required:**
- Snapshot do config object

**Risks / Notes:**
- {nomeProjeto} é dinâmico; confirmar que o NavigationService suporta tokens dinâmicos no breadcrumb.
