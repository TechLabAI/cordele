# 03 — Domain Framing (Frontend) — PUB (Publicação)

> Mirrors the BE domain language; does not redefine it. See `_brief.md` and the BE
> `03-domain-framing` for PUB (pending — M2). Data shapes derive from the BA data-model
> (draft v0.1.0) and the prototype `data-model.ts` / `mock-data.json`.

## 1. Ubiquitous Language

| Term (pt-BR) | Meaning in the UI |
|---|---|
| Publicação (Publicacao) | One **export** of a project to an ePub — **the aggregate PUB owns**. Holds `projetoId`, `arquivoUrl?`, `epubcheckStatus`, `totalErros`, `totalAvisos`, `erros?`, `criadoEm`. Each export is a new `Publicacao` row (an append-only ledger). |
| Exportar / Exportação | Requesting the generation of an ePub for a project — the T07 action; produces a new `Publicacao`. |
| Gerando | The in-flight build state: `pub-service` is compiling the ePub and running epubcheck; the `Publicacao` is `pendente` until a terminal verdict arrives. |
| epubcheck | The server-side ePub validator. Its output becomes `epubcheckStatus` + `totalErros` + `totalAvisos` + messages. **The FE renders it; it never runs it.** |
| Status epubcheck (`epubcheckStatus`) | The verdict enum: `valido` (0 errors), `avisos` (0 errors + non-blocking warnings — **still valid/downloadable**), `erros_criticos` (has errors — **download blocked**), `pendente` (still generating). |
| Aviso (não bloqueante) | A non-blocking epubcheck warning (`code`, `msg`, `local`) — shown but does **not** block download. |
| Erro crítico | A blocking epubcheck error — the ePub is not shippable; download is blocked; the fix path is back to COMP. |
| Arquivo (`arquivoUrl`) | The reference to the generated `.epub`, served through an authenticated backend URL; **present only** for a valid publication; `null` for `erros_criticos`. |
| Download / Baixar | Fetching the ePub from `arquivoUrl`; enabled **iff** `epubcheckStatus ∈ {valido, avisos}`. |
| Histórico de exportações | The list of all `Publicacao` rows for a project, newest first; the latest is the "versão atual". |
| Versão atual | The most recent `Publicacao` for the project (a UI marker, not a stored field). |
| Nova exportação | Starting another export (→ T07); for a `publicado`/`com_erros` project this is a re-export (Specs decides whether it reopens to `em_composicao` via PROJ). |
| Manuscrito | The imported content tree (IMP, immutable) — the ePub **body**; read by `pub-service` at build, never touched by PUB. |
| Metadados / Configuração de layout | COMP's aggregates — the OPF and stylesheet **inputs** to the build; read by `pub-service`, never written by PUB. |
| Projeto / Status | `ProjetoEditorial` + its `status` — read-only in PUB; a valid export **requests** `em_composicao → publicado`, a failed one `→ com_erros`, through PROJ. |
| Empresa / Editora | Tenant scoping the whole workspace (resolved server-side). |

## 2. View Models (draft)

### ExportVM (T07 — `/exportacao-e-validacao`)

| Field | Type | Notes |
|---|---|---|
| `projetoId` | `string` | route param; scopes the export |
| `phase` | `'gerando' \| 'valido' \| 'erros' \| 'error'` | UI state; `gerando`↔`pendente`, `valido`↔`valido\|avisos`, `erros`↔`erros_criticos`, `error`↔request failure |
| `progresso` | `number \| null` | 0–100 while `gerando`; from backend progress if available, else indeterminate (ADR-PUB-001) |
| `publicacao` | `PublicacaoVM \| null` | the terminal record once generation resolves |
| `podeBaixar` | `boolean` (computed) | `epubcheckStatus ∈ {valido, avisos}` |

### PublicacaoVM (shared by T07 result + T08 rows)

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | publication id |
| `projetoId` | `string` | ref → ProjetoEditorial |
| `epubcheckStatus` | `'valido' \| 'avisos' \| 'erros_criticos' \| 'pendente'` | the verdict |
| `totalErros` | `number` | epubcheck error count |
| `totalAvisos` | `number` | epubcheck warning count |
| `erros` | `string \| null` | short error summary (T08 row) |
| `arquivoUrl` | `string \| null` | download reference; present iff valid |
| `criadoEm` | `string` (ISO) | export timestamp (rendered `dd/MM/yyyy HH:mm`, pt-BR) |
| `avisos` | `{ code; msg; local }[]` | non-blocking warnings (T07 detail; may be lazy-loaded) |

### EpubSummaryVM (T07 — KPI grid for a valid export)

| Field | Type | Notes |
|---|---|---|
| `tamanho` | `string` | human file size (e.g. "1,4 MB") |
| `paginas` | `number` | page count |
| `capitulos` | `number` | chapter count (from IMP `Manuscrito`) |
| `imagens` | `number` | image count |

### HistoryVM (T08 — `/download-e-historico`)

| Field | Type | Notes |
|---|---|---|
| `projeto` | `{ id; nome; status; editora }` | read from PROJ (header + "Publicado" chip) |
| `meta` | `{ autor }` | read from COMP `Metadados` (header subtitle) |
| `publicacoes` | `PublicacaoVM[]` | newest-first; index 0 is "versão atual" |
| `status` | `'loading' \| 'ready' \| 'empty' \| 'error'` | list readiness |

## 3. UI Events

| Event | Screen | Effect |
|---|---|---|
| `requestExport(projetoId)` | T07 | on entry from COMP: `POST` generate → `Publicacao(pendente)`; `phase → gerando` |
| `resumeExport(projetoId)` | T07 | on re-entry: `GET` latest `Publicacao`; if `pendente`, resume `gerando`; else render terminal verdict |
| `pollStatus()` | T07 | while `gerando`: bounded status read until a terminal `epubcheckStatus` (ADR-PUB-001) |
| `showVerdict(publicacao)` | T07 | on terminal: `phase → valido | erros`; compute `podeBaixar`; a valid export **requests** `→ publicado`, a failed one `→ com_erros` (server-side, via PROJ) |
| `toggleWarnings()` | T07 | expand/collapse the non-blocking warnings `<details>` |
| `download(publicacao)` | T07/T08 | fetch `arquivoUrl` (authenticated) → browser download; enabled iff `podeBaixar` |
| `adjustLayout()` / `adjustMetadata()` | T07/T08 | navigate to COMP `/editor-de-layout-preview` / `/config` (fix path) |
| `openHistory(projetoId)` | T08 | `GET` project + metadata subtitle + `Publicacao[]`; hydrate `HistoryVM` |
| `newExport()` | T08 | navigate to T07 (re-export; reopen via PROJ if `publicado`/`com_erros` — Specs) |
| `backToLibrary()` | T08 | navigate to PROJ `/biblioteca-de-projetos` |
| `retry()` | T07/T08 | re-issue the failed generate / hydrate / download |

## 4. State Transitions (UI level)

```
EXPORT (T07):
  (enter from COMP) --requestExport--> gerando
  (re-enter)        --resumeExport--> gerando (if pendente) | valido | erros
  gerando --poll: valido/avisos--> valido   (podeBaixar = true)
  gerando --poll: erros_criticos--> erros   (podeBaixar = false, download blocked)
  gerando --request/network fail--> error --retry--> gerando
  valido  --download--> (browser download from arquivoUrl)
  valido  --Baixar CTA--> (navigate T08)
  erros   --Ajustar layout--> (navigate COMP)

HISTORY (T08):
  loading --get ok, list non-empty--> ready
  loading --get ok, list empty--> empty (→ Nova exportação)
  loading --error--> error --retry--> loading
  ready --download(row.arquivoUrl)--> (browser download)  [only when row.podeBaixar]
  ready --newExport--> (navigate T07)
```

## 5. Invariants (client-side)

- **Validity is never computed client-side:** `epubcheckStatus` and the counts come from `pub-service`;
  the UI maps them to banners but never *decides* válido vs erros (ADR-PUB-001).
- **Download is gated:** the "Baixar" affordance exists **iff** `epubcheckStatus ∈ {valido, avisos}` and
  `arquivoUrl` is non-null; a `erros_criticos`/`pendente` record renders "inválido"/blocked and offers
  no enabled download. `podeBaixar` is a `computed()` over the record, never a manually toggled flag.
- **The build is server-owned:** the SPA never compiles the ePub, runs epubcheck, or holds the file
  bytes; it only requests, polls, renders and downloads through the authenticated `arquivoUrl`.
- **`avisos` do not block:** a publication with warnings is valid and downloadable (BA rule); warnings
  are informational.
- **PUB requests, never writes, the project status:** a valid export drives `→ publicado`, a failed one
  `→ com_erros`, but the transition is authored by PROJ (`SolicitadoPor = pub`); PUB never writes
  `ProjetoEditorial.status`.
- **The history is append-only and server-ordered:** every export is a distinct `Publicacao`; the UI
  renders them newest-first and marks index 0 "versão atual" — it never mutates or reorders records.
- **The "gerando" state reflects real backend progress** (or an honest indeterminate), never a
  client-only fake timer (the prototype's `setInterval`/state-toggle is replaced — R-proto).
