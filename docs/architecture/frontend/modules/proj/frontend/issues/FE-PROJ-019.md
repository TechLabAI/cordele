## [FE-PROJ-019] Loading skeletons — LibrarySkeletonComponent + HistorySkeletonComponent (CLS-safe)

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/proj/ui` expõe `LibrarySkeletonComponent` (cards placeholder da T02) e
`HistorySkeletonComponent` (tabela placeholder da T08). Ambos têm altura fixa e evitam
Cumulative Layout Shift durante o carregamento inicial.

**Context / Problem statement:**
- SPEC-02 §1-2 especifica `LibrarySkeletonComponent` como estado `loading` da biblioteca e
  `HistorySkeletonComponent` para o histórico.
- CLS-safe: os skeletons devem ocupar o mesmo espaço que o conteúdo real (altura de card fixa,
  número de cards igual ao esperado — ex.: 3-6 placeholder cards).
- O skeleton da biblioteca **jamais** é renderizado quando `status === 'empty'` (SPEC-03 §1
  regra `isEmpty`).

**Approach (execution path):**
1. Criar `libs/proj/ui/src/lib/library-skeleton/library-skeleton.component.ts` (pres):
   - Renderiza N placeholder cards com altura fixa via CSS `content-visibility`.
   - Usa animação `shimmer` de `@cordele/shared/ui-feedback`.
2. Criar `libs/proj/ui/src/lib/history-skeleton/history-skeleton.component.ts` (pres):
   - Renderiza 3 linhas placeholder para a tabela de publicações.
3. Exportar via `index.ts`.

**Non-goals:**
- Não implementa o estado `empty` da biblioteca (está em `EmptyLibraryComponent`, FE-PROJ-012).
- Não implementa o skeleton do header do projeto (parte do FE-PROJ-014).

**Layer(s):**
frontend / libs/proj/ui

**Bounded context:**
proj

**Service execution spec(s):**
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-02-component-hierarchy.md` (§1, §2)

**Architecture alignment:**
- `standalone: true`, `changeDetection: OnPush`
- Tag Nx: `scope:proj`, `type:ui`
- Sem inputs: os skeletons são stateless

**Implementation checklist (by file):**

**Lib: libs/proj/ui**
- 🔲 `libs/proj/ui/src/lib/library-skeleton/library-skeleton.component.ts`
- 🔲 `libs/proj/ui/src/lib/history-skeleton/history-skeleton.component.ts`
- 🔲 `libs/proj/ui/src/index.ts` (re-exports)

**Tests**
- 🔲 `nx test proj-ui` PASS — `LibrarySkeletonComponent` renderiza sem erros
- 🔲 `nx test proj-ui` PASS — `HistorySkeletonComponent` renderiza sem erros
- 🔲 `nx lint proj-ui` PASS

**Milestone:**
Wave 5 / P5 UX Polish

**Labels:**
type:feature
layer:frontend
scope:proj
priority:P5

**Acceptance criteria:**
- `npx nx test proj-ui` PASS
- `npx nx lint proj-ui` PASS
- `LibrarySkeletonComponent` tem altura de card idêntica ao `ProjectCardComponent` real (verificado visualmente)
- Skeleton nunca é renderizado quando `status === 'empty'` (coberto pelo teste de FE-PROJ-012)

**Dependencies:**
- FE-PROJ-012 (usa `LibrarySkeletonComponent`)
- FE-PROJ-014 (usa `HistorySkeletonComponent`)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum

**Testing / Evidence required:**
- Screenshot do estado loading com skeletons (2 telas)

**Risks / Notes:**
- Se `@cordele/shared/ui-feedback` já tiver um componente de skeleton genérico, reutilizar
  em vez de criar do zero; confirmar que a animação shimmer está disponível.
