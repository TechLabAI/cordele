## [FE-COMP-024] Estados de UI — loading skeleton, error state, empty state (T05 e T06)

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
COMP tem estados de carregamento, erro e vazio correctamente implementados para T05 e T06:
`MetadataSkeletonComponent` (T05 loading), `PreviewSkeletonComponent` (T06 loading),
`PreviewEmptyComponent` (409 manuscript-missing), `ErrorStateComponent` (5xx — reutilizado
de `@cordele/shared/ui-feedback`). Todos com "Tentar novamente" quando aplicável.

**Context / Problem statement:**
- SPEC-02 §1/§2: `@if status='loading'` → skeleton; `@if status='error'` → ErrorState com
  retry; `@if status='empty'` → PreviewEmpty (T06 apenas).
- SPEC-07 §3: Error state (replaces content) para GET 5xx/network; empty state (in-content)
  para `409 manuscript-missing`; banner para `403 forbidden`; inline para `400/413/415`.
- `ErrorStateComponent` vem de `@cordele/shared/ui-feedback` (reutilizado, não criado).
- COMP-específicos: `MetadataSkeletonComponent` e `PreviewSkeletonComponent` em `libs/comp/ui`;
  `PreviewEmptyComponent` em `libs/comp/ui`.

**Approach (execution path):**
1. Criar `MetadataSkeletonComponent` em `libs/comp/ui`: skeleton CLS-safe do formulário T05.
2. Criar `PreviewSkeletonComponent` em `libs/comp/ui`: skeleton do canvas + painel de estilos T06.
3. Criar `PreviewEmptyComponent` em `libs/comp/ui`: "Ainda não há manuscrito para pré-visualizar."
   com instrução de voltar ao IMP; painel de estilos continua visível.
4. Garantir que `ErrorStateComponent` de `@cordele/shared/ui-feedback` está importado nas
   feature libs e recebe o `correlationId`.
5. Verificar que `@if status=...` está correcto em T05/T06 (FE-COMP-011, FE-COMP-014).

**Non-goals:**
- Não cria novos `ErrorStateComponent` (reutiliza o shared).
- Não implementa modal (sem modal no MVP).

**Layer(s):**
frontend / libs/comp/ui · libs/comp/feature-metadata · libs/comp/feature-layout

**Bounded context:**
comp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-02-component-hierarchy.md` (§1, §2)
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-07-error-handling.md` (§3)

**Architecture alignment:**
- Tag Nx: `scope:comp`, `type:ui`
- Skeletons com `aspect-ratio` / `min-height` para evitar CLS

**Implementation checklist (by file):**

**Lib: libs/comp/ui**
- 🔲 `libs/comp/ui/src/lib/metadata-skeleton/metadata-skeleton.component.ts`
- 🔲 `libs/comp/ui/src/lib/preview-skeleton/preview-skeleton.component.ts`
- 🔲 `libs/comp/ui/src/lib/preview-empty/preview-empty.component.ts`

**Verificação nas feature libs**
- 🔲 `configuracoes.component.ts` tem `@if status='loading'` → MetadataSkeleton; `@if status='error'` → ErrorState
- 🔲 `editor-de-layout-preview.component.ts` tem `@if status='empty'` → PreviewEmpty; `@if status='error'` → ErrorState

**Tests**
- 🔲 `nx test comp-ui` PASS
- 🔲 `nx lint comp-ui` PASS

**Milestone:**
Wave 7 / P7 UX polish

**Labels:**
type:feature
layer:frontend
scope:comp
priority:P7

**Acceptance criteria:**
- `npx nx test comp-ui` PASS
- PreviewEmptyComponent visível com `409 manuscript-missing`; painel de estilos intacto
- ErrorStateComponent exibe `correlationId`
- MetadataSkeleton e PreviewSkeleton sem layout shift (CLS-safe)

**Dependencies:**
- FE-COMP-011 (T05), FE-COMP-014 (T06), FE-COMP-010 (error mapping)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum

**Testing / Evidence required:**
- Teste de renderização condicional: status=loading → skeleton; status=error → ErrorState com retry; status=empty → PreviewEmpty

**Risks / Notes:**
- `PreviewEmptyComponent` deve deixar o painel de estilos T06 visível (o utilizador pode ainda editar tipografia sem ter manuscrito importado — o layout hidrata normalmente).
