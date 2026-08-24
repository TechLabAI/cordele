## [FE-IMP-012] Componentes presentacionais T03 — ProjectNameField, ManuscriptDropZone

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/imp/feature-upload/src/lib/components/` contém `ProjectNameFieldComponent` e
`ManuscriptDropZoneComponent` como componentes standalone OnPush prontos para receber inputs
de `UploadComponent`.

**Context / Problem statement:**
- SPEC-02 §1 define a árvore de componentes de T03. Os componentes presentacionais não injetam
  facade nem `HttpClient` — só recebem `input()` signals e emitem `output()` events.
- `ManuscriptDropZoneComponent` aceita drag-and-drop + click-to-select, valida extensão
  (`.docx`, `.md`) e tamanho (≤ 50 MB) client-side antes de emitir `fileSelected`.
- Validação client-side pre-empe os erros 415/413 do servidor (SPEC-07 §3).
- Bloqueia: FE-IMP-013 (UploadComponent)

**Approach (execution path):**
1. Criar `ProjectNameFieldComponent` (standalone OnPush):
   - `input() value: Signal<string>`, `output() valueChange: EventEmitter<string>`
   - Campo `<input type="text" required minlength="3">` com mensagem de validação inline.
2. Criar `ManuscriptDropZoneComponent` (standalone OnPush):
   - `input() accept: Signal<string>` (`.docx,.md`), `input() maxBytes: Signal<number>` (50MB),
     `input() disabled: Signal<boolean>`
   - Drag-and-drop surface + `<input type="file" hidden>` acionado por click
   - Valida ext + size → `output() fileSelected: EventEmitter<File>` | `output() validationError: EventEmitter<string>`
   - Mensagem de erro inline no slot de validação
3. Ambos sem dependência de `HttpClient` ou façades.

**Non-goals:**
- Não implementa `UploadProgressCardComponent` nem `ImportSubmitButtonComponent` (FE-IMP-013).
- Não conecta ao façade.

**Layer(s):**
frontend / libs/imp/feature-upload

**Bounded context:**
imp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/SPEC-02-component-hierarchy.md` (§1)
- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/SPEC-07-error-handling.md` (§3 — inline channel)

**Architecture alignment:**
- Standalone + OnPush + Signals
- Tag Nx: `scope:imp`, `type:feature`

**Implementation checklist (by file):**

**Lib: libs/imp/feature-upload**
- 🔲 `libs/imp/feature-upload/src/lib/components/project-name-field/project-name-field.component.ts`
- 🔲 `libs/imp/feature-upload/src/lib/components/manuscript-drop-zone/manuscript-drop-zone.component.ts`
- 🔲 `libs/imp/feature-upload/src/lib/components/manuscript-drop-zone/manuscript-drop-zone.component.html`

**Tests**
- 🔲 `nx test imp-feature-upload` PASS (dropzone rejeita PDF; dropzone rejeita arquivo > 50MB;
  ProjectNameField emite valueChange)
- 🔲 `nx lint imp-feature-upload` PASS

**Milestone:**
Wave 3 / P3 Feature Libs

**Labels:**
type:feature
layer:frontend
scope:imp
priority:P3

**Acceptance criteria:**
- `npx nx test imp-feature-upload` PASS
- `npx nx lint imp-feature-upload` PASS
- `npx nx build imp-feature-upload` PASS
- Arquivo `.pdf` emite `validationError` sem `fileSelected`
- Arquivo > 50MB emite `validationError` sem `fileSelected`

**Dependencies:**
- FE-IMP-001 (constantes de permissão — para saber quais extensões aceitar)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum (validação client-side pré-request)

**Testing / Evidence required:**
- Testes unitários de validação do drop-zone

**Risks / Notes:**
- Prototype source: `frontend/design-reference/angular-prototype/apps/cordele-web/src/app/screens/upload/`
  — extrair classes CSS relevantes mas remover mock imports.
