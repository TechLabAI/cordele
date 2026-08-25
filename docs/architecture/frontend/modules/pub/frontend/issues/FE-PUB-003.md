## [FE-PUB-003] Module descriptor + bootstrap — pub.descriptor.ts, pub.bootstrap.ts

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/pub/shell-entry` exporta `PUB_MODULE_DESCRIPTOR` (key, menu, loadChildren, permission + flag maps)
e `pub.bootstrap.ts` (`init` / `destroy`) que registra/remove as contribuições de nav de PUB no Shell e
cancela o poll em andamento ao sair.

**Context / Problem statement:**
- SPEC-05 §4 e SPEC-06 §1 definem o descriptor e o bootstrap.
- `init` registra PUB_NAV_CONFIG (step-bar stage 4 "Exportar" + breadcrumb), inicia EmpresaContext sub via PubShellIntegrationService.
- `destroy` remove nav, para o poll em andamento, limpa sub de empresa.
- Consumido pelo Shell em `module-descriptors.ts` (FE-PUB-004).
- Bloqueia: FE-PUB-004, FE-PUB-006

**Approach (execution path):**
1. Criar `libs/pub/shell-entry/src/lib/pub.descriptor.ts`:
   - `PUB_MODULE_DESCRIPTOR: ModuleDescriptor` com key='pub', PUB_MENU_METADATA,
     `loadChildren: () => import('@cordele/pub').then(m => m.PubModule)`,
     PUB_PERMISSION_MAP, PUB_FEATURE_FLAGS.
2. Criar `libs/pub/shell-entry/src/lib/pub.bootstrap.ts`:
   - `init(ctx)`: `ctx.nav.register(PUB_NAV_CONFIG)`, inject+start PubShellIntegrationService.
   - `destroy(ctx)`: `ctx.integration.stop()`, `ctx.nav.unregister(MODULE_KEY)`.
3. Re-exportar via index.ts.

**Non-goals:**
- Não registra no Shell (FE-PUB-004).
- Não implementa PubShellIntegrationService (FE-PUB-006).

**Layer(s):**
frontend / libs/pub/shell-entry

**Bounded context:**
pub

**Service execution spec(s):**
- `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-05-tool-contract.md` (§4)
- `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-06-shell-integration.md` (§3)

**Architecture alignment:**
- Tag Nx: `scope:pub`, `type:app`
- destroy() não deve deixar dangling sub de empresa nem poll ativo

**Implementation checklist (by file):**

**Lib: libs/pub/shell-entry**
- 🔲 `libs/pub/shell-entry/src/lib/pub.descriptor.ts`
- 🔲 `libs/pub/shell-entry/src/lib/pub.bootstrap.ts`
- 🔲 `libs/pub/shell-entry/src/index.ts` (re-exports)

**Tests**
- 🔲 `nx test pub-shell-entry` PASS (destroy chama nav.unregister e integration.stop)
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
- `destroy()` invocado: nav.unregister chamado + integration.stop chamado
- Nenhum setTimeout/setInterval em pub.bootstrap.ts

**Dependencies:**
- FE-PUB-001, FE-PUB-002, FE-PUB-005, FE-PUB-006

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum

**Testing / Evidence required:**
- Spy em ctx.nav.unregister confirma chamada no destroy

**Risks / Notes:**
- ExportFacade/HistoryFacade são providos no escopo da lazy route — GC'd pelo route injector; destroy apenas lida com a integração de shell.
