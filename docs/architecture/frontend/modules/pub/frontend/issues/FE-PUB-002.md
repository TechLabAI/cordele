## [FE-PUB-002] Module routes — pub.routes.ts, PubRootComponent

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/pub/shell-entry/src/lib/pub.routes.ts` exporta `PUB_ROUTES` com a rota `/pub`
(PubRootComponent redirect → biblioteca-de-projetos) e as rotas deep-link
`/projetos/:projetoId/exportacao-e-validacao` e `/projetos/:projetoId/download-e-historico`
com seus guards e `loadComponent` lazy para as feature libs correspondentes.

**Context / Problem statement:**
- SPEC-01 §1 define a tabela de rotas: PubRootComponent (redirect), ExportacaoEValidacaoComponent (T07),
  DownloadEHistoricoComponent (T08).
- Guards de cada rota: authGuard, empresaGuard, accessGuard, pubProjetoGuard, pubStatusGuard.
- PUB não é landing module — todas as entradas chegam com projetoId de COMP/PROJ.
- Bloqueia: FE-PUB-012 (feature-export), FE-PUB-018 (feature-history)

**Approach (execution path):**
1. Criar `libs/pub/shell-entry/src/lib/pub.routes.ts` com `PUB_ROUTES: Routes`.
2. Rota `/pub`: `PubRootComponent`, guards [authGuard, empresaGuard, accessGuard('pub.view')].
3. Rota `/projetos/:projetoId/exportacao-e-validacao`: `loadComponent` → `ExportacaoEValidacaoComponent`,
   guards [authGuard, empresaGuard, accessGuard('pub.export'), pubProjetoGuard, pubStatusGuard('export')].
4. Rota `/projetos/:projetoId/download-e-historico`: `loadComponent` → `DownloadEHistoricoComponent`,
   guards [authGuard, empresaGuard, accessGuard('pub.view'), pubProjetoGuard, pubStatusGuard('history')].
5. `PubRootComponent`: standalone, redireciona para biblioteca-de-projetos (PROJ).

**Non-goals:**
- Não implementa os guards (FE-PUB-021, FE-PUB-022).
- Não implementa os componentes de feature (FE-PUB-012, FE-PUB-018).

**Layer(s):**
frontend / libs/pub/shell-entry

**Bounded context:**
pub

**Service execution spec(s):**
- `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-01-route-map.md` (§1, §2, §3)

**Architecture alignment:**
- Tag Nx: `scope:pub`, `type:app`
- Routes lazy via `loadComponent` (standalone pattern)
- Sem rotas hard-coded no Shell

**Implementation checklist (by file):**

**Lib: libs/pub/shell-entry**
- 🔲 `libs/pub/shell-entry/src/lib/pub.routes.ts` (PUB_ROUTES: Routes)
- 🔲 `libs/pub/shell-entry/src/lib/pub-root.component.ts` (PubRootComponent, redirect)
- 🔲 `libs/pub/shell-entry/src/index.ts` (re-exports PUB_ROUTES)

**Tests**
- 🔲 `nx test pub-shell-entry` PASS (routes existem, guards listados corretamente)
- 🔲 `nx lint pub-shell-entry` PASS

**Milestone:**
Wave 1 / P1 Foundation

**Labels:**
type:feature
layer:frontend
scope:pub
priority:P1

**Acceptance criteria:**
- `npx nx test pub-shell-entry` PASS
- `npx nx lint pub-shell-entry` PASS
- PUB_ROUTES contém exatamente 3 entries (root, T07, T08)
- T07 e T08 usam `loadComponent` (lazy)
- pubStatusGuard('export') apenas admite projetos em_composicao

**Dependencies:**
- FE-PUB-001 (MODULE_KEY, constantes)
- FE-PUB-021 (pubProjetoGuard), FE-PUB-022 (pubStatusGuard)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum (só routing)

**Testing / Evidence required:**
- TestBed confirma que `/projetos/uuid/exportacao-e-validacao` ativa o guard correto

**Risks / Notes:**
- PubRootComponent não deve tentar renderizar conteúdo de PUB — é apenas redirect.
- Guards são importados de `libs/pub/access` (FE-PUB-021/022) e `@cordele/shared/access-decision`.
