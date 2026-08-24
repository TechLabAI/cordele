# 03 — Domain Framing (Frontend) — IMP (Importação)

> Mirrors the BE domain language; does not redefine it. See `_brief.md` and the BE
> `03-domain-framing` for IMP. Data shapes derive from the BA data-model (draft v0.1.0) and the
> prototype `data-model.ts` / `mock-data.json`.

## 1. Ubiquitous Language

| Term (pt-BR) | Meaning in the UI |
|---|---|
| Projeto (ProjetoEditorial) | The editorial project created at import; holds name + status (`rascunho`, `em_composicao`, ...). |
| Manuscrito | The uploaded, parsed file — **immutable after import**; `formato ∈ {docx, markdown}`. |
| Estrutura detectada | The parse result: chapters, images and unparsed fragments. |
| Capítulo | A detected chapter (title only at this stage). |
| Pendência / Trecho não parseado | A fragment the parser could not map to ePub (table, text box, ...). |
| Ignorar | Editor decision to knowingly drop a pending fragment. |
| Confirmar estrutura | Editor accepts the detected structure; advances to composition. |
| Empresa | Tenant (editora) owning the project. |

## 2. View Models (draft)

### UploadVM (T03 — `/upload`)

| Field | Type | Notes |
|---|---|---|
| `nome` | `string` | project name; required, `trim().length >= 3` |
| `file` | `File \| null` | selected manuscript |
| `fileName` | `string` | display name |
| `state` | `'idle' \| 'uploading' \| 'parsing' \| 'done' \| 'error'` | drives the drop zone / progress card |
| `progressPct` | `number` | 0–100 upload+parse progress |
| `errorMessage` | `string` | inline validation / upload error |
| `canSubmit` | `boolean` (computed) | `nome` valid AND a valid file selected |
| `projetoId` | `string \| null` | set after successful import; used to navigate to review |

### StructureReviewVM (T04 — `/revisao-de-estrutura`)

| Field | Type | Notes |
|---|---|---|
| `manuscrito.nomeArquivo` | `string` | source file name |
| `manuscrito.formato` | `'docx' \| 'markdown'` | |
| `totalCapitulos` | `number` | counter tile |
| `totalImagens` | `number` | counter tile |
| `trechosNaoParseados` | `number` | pending counter tile |
| `capitulos` | `{ n: number; titulo: string }[]` | collapsible ToC (partial list + "+N more") |
| `pendencias` | `Trecho[]` | see below |
| `status` | `'loading' \| 'ready' \| 'error'` | parse readiness |

`Trecho`: `{ id: string; pagina: number; capitulo: string; tipo: string; descricao: string; ignorado: boolean }`.

## 3. UI Events

| Event | Screen | Effect |
|---|---|---|
| `nomeChanged(value)` | T03 | updates `nome`, recomputes `canSubmit` |
| `fileSelected(file)` / `fileDropped(file)` | T03 | validates type/size → `error` or begins upload |
| `submitImport()` | T03 | `POST` manuscript; `state → uploading → parsing`; on ready sets `projetoId`, navigates to T04 |
| `resetUpload()` | T03 | clears file, `state → idle` |
| `ignoreFragment(id)` | T04 | marks a `Trecho` `ignorado`; `POST` ignore to BE (optimistic) |
| `confirmStructure()` | T04 | `POST` confirm; on success navigates to COMP (`/config`) |
| `reimport()` | T04 | navigates back to `/upload` |

## 4. State Transitions (UI level)

```
UPLOAD (T03):
  idle --fileSelected(valid)--> uploading --progress--> parsing --ready--> done --submitImport--> (navigate T04)
  idle --fileSelected(invalid)--> error --resetUpload--> idle
  uploading|parsing --network/parse error--> error --resetUpload--> idle

REVIEW (T04):
  loading --parse ready--> ready
  ready --ignoreFragment--> ready (fragment.ignorado=true; rollback on POST failure)
  ready --confirmStructure(success)--> (navigate COMP)
  loading|ready --error--> error --reimport--> (navigate T03)
```

## 5. Invariants (client-side)

- `nome` is required and must have `trim().length >= 3`; the Import CTA stays disabled otherwise.
- File extension must be `.docx` or `.md` and size ≤ 50 MB — validated before any request.
- Exactly **one** manuscript per import; selecting a new file replaces the previous selection.
- "Confirmar estrutura" is **allowed even with `trechosNaoParseados > 0`** — the editor decides
  (principle §2.1). A confirm with 0 chapters shows a warning first.
- Pending fragments are always rendered; the pending counter is never hidden or auto-dismissed.
- Ignoring a fragment is reversible only by re-import (no un-ignore in MVP); the UI reflects the
  ignored state immediately (optimistic) and rolls back on server rejection.
