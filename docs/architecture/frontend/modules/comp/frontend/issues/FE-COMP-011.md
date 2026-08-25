## [FE-COMP-011] feature-metadata routes + ConfiguracoesComponent (T05 — smart)

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/comp/feature-metadata` contém `metadata.routes.ts` e `ConfiguracoesComponent`
(promovido do protótipo BA). O componente smart consome `MetadataFacade` via signals,
delega para componentes presentacionais e nunca toca em `HttpClient`. Mock imports
(`shared/mock-data`) removidos.

**Context / Problem statement:**
- SPEC-02 §1 define a árvore de componentes de T05 e os signals que o smart component lê.
- `prototype_source` = `apps/cordele-web/src/app/screens/configuracoes/configuracoes.component.ts`
  (D-493): promover o ficheiro existente para `libs/comp/feature-metadata`, não recriar.
- Ao promover: remover imports de `shared/mock-data`; substituir por chamadas de Facade.
- Os literais `oklch(...)` na surface de fundo são tratados em FE-COMP-022 (tokens).
- Bloqueia: FE-COMP-012 (presentacionais), FE-COMP-013 (CoverDropZone)

**Approach (execution path):**
1. Criar `libs/comp/feature-metadata/src/lib/metadata.routes.ts` com a rota
   `/projetos/:projetoId/config` (loadComponent → `ConfiguracoesComponent`).
2. Mover / copiar `configuracoes.component.ts` do protótipo para a lib.
3. Remover todos os imports de `shared/mock-data`; substituir dados mock por
   `MetadataFacade` injetado.
4. Declarar os signals lidos: `status()`, `form()`, `cover()`, `canAdvance()`, `materialized()`.
5. Delegar eventos de UI para os métodos da Facade.
6. Garantir `standalone: true`, `changeDetection: OnPush`.

**Non-goals:**
- Não implementa os sub-componentes presentacionais (FE-COMP-012, FE-COMP-013).
- Não toca na Facade (FE-COMP-008).
- Não remove toolbar de T06 (FE-COMP-021 — issue separada).

**Layer(s):**
frontend / libs/comp/feature-metadata

**Bounded context:**
comp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-02-component-hierarchy.md` (§1)
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-01-route-map.md` (§1)
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/generator-config.yml` (features[0])

**Architecture alignment:**
- Tag Nx: `scope:comp`, `type:feature`
- standalone + OnPush; selector `app-comp-configuracoes`
- Não importa libs de IMP/PROJ/PUB diretamente

**Implementation checklist (by file):**

**Lib: libs/comp/feature-metadata**
- 🔲 `libs/comp/feature-metadata/src/lib/metadata.routes.ts`
- 🔲 `libs/comp/feature-metadata/src/lib/configuracoes/configuracoes.component.ts` (promovido)
- 🔲 `libs/comp/feature-metadata/src/index.ts`
- 🔲 `libs/comp/feature-metadata/project.json` (tags scope:comp, type:feature)

**Tests**
- 🔲 `nx test comp-feature-metadata` PASS (renderização com MetadataFacade stub)
- 🔲 `nx lint comp-feature-metadata` PASS

**Milestone:**
Wave 3 / P3 Feature libs

**Labels:**
type:feature
layer:frontend
scope:comp
priority:P3

**Acceptance criteria:**
- `npx nx test comp-feature-metadata` PASS
- `npx nx lint comp-feature-metadata` PASS
- Nenhum import de `shared/mock-data` no componente
- Componente lê signals de `MetadataFacade` sem injetar `HttpClient`

**Dependencies:**
- FE-COMP-008 (MetadataFacade), FE-COMP-002 (rotas globais), FE-COMP-019 (compProjetoGuard), FE-COMP-020 (compStatusGuard)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Indireto via MetadataFacade

**Testing / Evidence required:**
- Teste de renderização: status loading → skeleton; status ready → form; canAdvance false → botão desabilitado

**Risks / Notes:**
- Verificar se o componente protótipo usa NgIf/NgFor legados; converter para `@if`/`@for` da sintaxe de control flow do Angular 17+.
