## [FE-COMP-013] CoverDropZoneComponent — upload capa, flag comp.coverUpload, erros 413/415

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/comp/ui/src/lib/cover-drop-zone/cover-drop-zone.component.ts` implementa o drop zone
de capa com: prévia via objectUrl, indicador de upload, erro inline para 413/415, e
ocultação quando a feature flag `comp.coverUpload` está `off`. Cover é opcional (D-L).

**Context / Problem statement:**
- SPEC-02 §1: `CoverDropZoneComponent` em `libs/comp/ui` com inputs `capaUrl`, `uploading`,
  `error: CoverError|null` e outputs `fileSelected(File)`, `remove()`.
- SPEC-05 §3: `WHERE comp.coverUpload is off, THE SYSTEM SHALL NOT render the cover drop zone`.
- SPEC-07 §1: `413 cover-too-large` → "A capa excede 10 MB"; `415 unsupported-cover-format`
  → "Formato inválido. Use JPEG, PNG ou WebP.". Erros inline; formulário intacto.
- Aceita `image/jpeg|png|webp`; filtro no `accept` attribute e validação client-side antes de emitir.

**Approach (execution path):**
1. Criar `CoverDropZoneComponent` em `libs/comp/ui`.
2. input `capaUrl: string|null`, `uploading: boolean`, `error: CoverError|null`, `canEdit: boolean`.
3. output `fileSelected: EventEmitter<File>`, `remove: EventEmitter<void>`.
4. `@if` com `AccessDecisionService.has('comp.coverUpload')` para renderização condicional.
5. Validação client-side: `file.size > 10*1024*1024` → emite error local `too-large`;
   `!['image/jpeg','image/png','image/webp'].includes(file.type)` → `unsupported-format`.
6. Enquanto `uploading=true`, desabilitar o drop zone; mostrar spinner.
7. Exibir `capaUrl` ou `objectUrl` como thumbnail.

**Non-goals:**
- Não faz HTTP (responsabilidade da MetadataFacade via FE-COMP-008).
- Não exibe modal de confirmação de remoção (sem modal no MVP — SPEC-07 §3).

**Layer(s):**
frontend / libs/comp/ui

**Bounded context:**
comp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-02-component-hierarchy.md` (§1 CoverDropZoneComponent)
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-05-tool-contract.md` (§3 comp.coverUpload)
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-07-error-handling.md` (§1 413/415)

**Architecture alignment:**
- Tag Nx: `scope:comp`, `type:ui`
- standalone + OnPush; sem lógica de negócio além de validação de ficheiro

**Implementation checklist (by file):**

**Lib: libs/comp/ui**
- 🔲 `libs/comp/ui/src/lib/cover-drop-zone/cover-drop-zone.component.ts`
- 🔲 `libs/comp/ui/src/lib/cover-drop-zone/cover-drop-zone.component.html`
- 🔲 `libs/comp/ui/src/index.ts` (re-export)

**Tests**
- 🔲 `nx test comp-ui` PASS
  - `comp.coverUpload=off` → componente não renderizado
  - Ficheiro > 10MB → emite error `too-large`; formulário intacto
  - TIFF → emite error `unsupported-format`
- 🔲 `nx lint comp-ui` PASS

**Milestone:**
Wave 3 / P3 Feature libs

**Labels:**
type:feature
layer:frontend
scope:comp
priority:P3

**Acceptance criteria:**
- `npx nx test comp-ui` PASS
- `npx nx lint comp-ui` PASS
- Drop zone não renderiza quando `comp.coverUpload=off`
- Erros 413/415 exibidos inline; resto do formulário intacto

**Dependencies:**
- FE-COMP-001 (feature flags), INT-FE-COMP-005 (AccessDecisionService)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum (só emite `File`; o HTTP é da Facade)

**Testing / Evidence required:**
- Teste de DOM: drop zone visível/oculto conforme flag; mensagens de erro corretas

**Risks / Notes:**
- Validação client-side é defensive (413/415 chegam do BE via interceptor mesmo se o FE não valida); manter ambas para UX responsivo.
