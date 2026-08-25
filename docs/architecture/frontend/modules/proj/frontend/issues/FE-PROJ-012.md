## [FE-PROJ-012] Promote T02 → feature-library — BibliotecaDeProjetosComponent + header + empty state

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/proj/feature-library` contém `BibliotecaDeProjetosComponent` (smart) promovida do protótipo BA,
desconectada de mocks, conectada à `LibraryFacade`. Inclui `LibraryHeaderComponent` e
`EmptyLibraryComponent` (presentacionais). Cores inline `oklch(...)` substituídas por design tokens.

**Context / Problem statement:**
- D-493 (prototype-to-production): o componente existe em
  `frontend/design-reference/angular-prototype/apps/cordele-web/src/app/screens/biblioteca-de-projetos/`.
- A Promote NÃO re-inventa a UI — ela move o arquivo, remove os imports de mock, injeta a facade e
  troca as cores inline por tokens de `@cordele/shared/ui-theme`.
- `BibliotecaDeProjetosComponent` (smart): lê `LibraryFacade.status()`, `projects()`, `isEmpty()`.
  Emite eventos: `onNewProject()`, `onOpen(card)`, `onQuickDownload(card)`, `onRetry()`.
- `LibraryHeaderComponent` (pres): `input(projectCount, empresaNome)`, `output(newProject)`.
- `EmptyLibraryComponent` (pres): `output(uploadFirst)` → navega para IMP `/upload`.
- Bloqueia: FE-PROJ-013 (ProjectCard usa StatusBadge de libs/proj/ui); FE-PROJ-024 (e2e T02)

**Approach (execution path):**
1. Copiar `biblioteca-de-projetos.component.ts` e `.html` do protótipo para
   `libs/proj/feature-library/src/lib/biblioteca-de-projetos/`.
2. Remover imports de mock (`MockBibliotecaService` ou equivalente).
3. Injetar `LibraryFacade` via `inject(LibraryFacade)`.
4. Substituir `status === 'loading'` por `LibraryFacade.status()` (signal); aplicar `@if` com
   enum literais (`'loading'`, `'error'`, `'empty'`, `'ready'`).
5. Extrair `LibraryHeaderComponent` e `EmptyLibraryComponent` como standalone presentacionais.
6. Substituir todas as ocorrências de `oklch(...)` inline por variáveis CSS de design tokens
   (`var(--proj-status-draft-bg)` etc.; tokens definidos em `contracts/design-tokens.md`).
7. Atualizar `libs/proj/feature-library/src/index.ts`.

**Non-goals:**
- Não implementa `ProjectCardComponent` nem `StatusBadgeComponent` (FE-PROJ-013).
- Não implementa o download por URL assinada (FE-PROJ-016).

**Layer(s):**
frontend / libs/proj/feature-library

**Bounded context:**
proj

**Service execution spec(s):**
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-02-component-hierarchy.md` (§1)
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-03-view-models.md` (§1)
- `docs/architecture/frontend/modules/proj/frontend/contracts/design-tokens.md`

**Architecture alignment:**
- `standalone: true`, `changeDetection: OnPush`, selector `app-proj-biblioteca-de-projetos`
- Tag Nx: `scope:proj`, `type:feature`
- Componente smart lê sinais; presentacionais só `input()`/`output()`

**Implementation checklist (by file):**

**Lib: libs/proj/feature-library**
- 🔲 `libs/proj/feature-library/src/lib/biblioteca-de-projetos/biblioteca-de-projetos.component.ts`
- 🔲 `libs/proj/feature-library/src/lib/biblioteca-de-projetos/biblioteca-de-projetos.component.html`
- 🔲 `libs/proj/feature-library/src/lib/library-header/library-header.component.ts`
- 🔲 `libs/proj/feature-library/src/lib/empty-library/empty-library.component.ts`
- 🔲 `libs/proj/feature-library/src/lib/feature-library.routes.ts` (lazy route para esta tela)
- 🔲 `libs/proj/feature-library/src/index.ts`

**Tests**
- 🔲 `nx test proj-feature-library` PASS — `status=loading` renderiza skeleton, não a grid
- 🔲 `nx test proj-feature-library` PASS — `status=empty` renderiza EmptyLibraryComponent, não a grid
- 🔲 `nx test proj-feature-library` PASS — `status=error` renderiza ErrorStateComponent
- 🔲 `nx test proj-feature-library` PASS — `onNewProject()` chama Router.navigate para IMP
- 🔲 `nx lint proj-feature-library` PASS

**Milestone:**
Wave 3 / P3 Feature Libraries

**Labels:**
type:feature
layer:frontend
scope:proj
priority:P3

**Acceptance criteria:**
- `npx nx test proj-feature-library` PASS
- `npx nx lint proj-feature-library` PASS
- `npx nx build proj-feature-library` PASS
- Nenhum import de mock no bundle de produção
- Nenhuma ocorrência de `oklch(` no HTML/TS do componente promovido

**Dependencies:**
- FE-PROJ-009 (LibraryFacade)
- FE-PROJ-011 (ProjetoNavigationService para `onOpen`)

**Data impact:**
- Nenhum (FE não persiste)

**API / Contract impact:**
- Consome `GET /api/proj/projetos` via LibraryFacade

**Testing / Evidence required:**
- Screenshot do estado `empty` (dashed CTA)
- Screenshot do estado `loading` (skeletons visíveis)

**Risks / Notes:**
- Verificar se o protótipo usa imports de `@angular/forms` ou `@angular/material` não presentes
  no `feature-library`; adicionar apenas o necessário.
- CLS-safe skeleton: altura dos cards deve ser fixa enquanto `status=loading`.
