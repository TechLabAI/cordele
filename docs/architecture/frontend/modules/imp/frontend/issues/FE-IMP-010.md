## [FE-IMP-010] ImportFacade — máquina de estados do upload (signals)

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/imp/data-access/src/lib/facades/import.facade.ts` implementa a máquina de estados de upload
com signals: `idle → uploading → parsing → done | error → idle`. Expõe `UploadVM` como signals
readonly para `UploadComponent`.

**Context / Problem statement:**
- SPEC-04 §2 e SPEC-03 §1 definem o estado e os eventos do upload.
- A facade é a única que toca `ManuscriptApiService`; componentes só lêem signals.
- Fase `uploading` emite `progressPct` de `HttpEventType.UploadProgress`.
- Fase `parsing` começa quando upload chega a 100% mas o response ainda não chegou (indeterminada).
- Fase `done` captura `manuscritoId` + `projetoId` do body 201 e dispara navegação.
- Empresa-switch cancela o upload via signal de `ImpShellIntegrationService`.
- Bloqueia: FE-IMP-013 (UploadComponent)

**Approach (execution path):**
1. Criar `ImportFacade` com `inject(ManuscriptApiService)` e signals internos writable:
   `_state`, `_progressPct`, `_errorMessage`, `_fileName`, `_nome`, `_file`, `_binding`.
2. Expor readonly: `state`, `progressPct`, `errorMessage`, `fileName`, `nome`, `file`,
   `canSubmit` (computed), `manuscritoId`, `projetoId`.
3. Implementar `submit()`: valida binding → chama `upload()` → pipe sobre `HttpEvent`:
   - `UploadProgress` → `_state('uploading')`, `_progressPct(100*loaded/total)`
   - Todos bytes enviados mas sem response → `_state('parsing')`
   - `HttpResponse` (201) → `_state('done')`, gravar `manuscritoId`/`projetoId`
4. Implementar `setNome()`, `setFile()`, `reset()`, `retry()` (→ reset).
5. Cancelar subscription em empresa-switch via `takeUntil(empresaChanged$)`.
6. `canSubmit` computed: `state ∈ {idle,error}` AND file válido AND binding válido.

**Non-goals:**
- Não implementa componentes (FE-IMP-013).
- Não implementa ReviewFacade (FE-IMP-011).

**Layer(s):**
frontend / libs/imp/data-access

**Bounded context:**
imp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/SPEC-04-data-access.md` (§2)
- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/SPEC-03-view-models.md` (§1)

**Architecture alignment:**
- Signals-first, sem NgRx
- Tag Nx: `scope:imp`, `type:data-access`

**Implementation checklist (by file):**

**Lib: libs/imp/data-access**
- 🔲 `libs/imp/data-access/src/lib/facades/import.facade.ts`
- 🔲 `libs/imp/data-access/src/index.ts` (re-export)

**Tests**
- 🔲 `nx test imp-data-access` PASS (state machine: idle→uploading→parsing→done; idle→error; retry→idle)
- 🔲 `nx lint imp-data-access` PASS

**Milestone:**
Wave 2 / P2 Data Access

**Labels:**
type:feature
layer:frontend
scope:imp
priority:P2

**Acceptance criteria:**
- `npx nx test imp-data-access` PASS
- `npx nx lint imp-data-access` PASS
- `npx nx build imp-data-access` PASS
- `state` transita corretamente em cada HttpEvent
- Upload com binding inválido NÃO emite request (teste unitário confirma)
- Empresa-switch cancela subscription

**Dependencies:**
- FE-IMP-007 (ManuscriptApiService.upload)
- FE-IMP-006 (DTOs)

**Data impact:**
- Nenhum client-side persistente

**API / Contract impact:**
- `POST /api/imp/manuscripts` (via ManuscriptApiService)

**Testing / Evidence required:**
- Teste com `ManuscriptApiService` mockado confirmando transições de estado
- Teste de empresa-switch: subscription cancelada

**Risks / Notes:**
- `canSubmit` depende de lógica de computed com dois branches de binding (create vs existing).
  Testar os dois.
