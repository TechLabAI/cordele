# 03 — Domain Framing (Frontend) — PROJ (Projetos)

> Mirrors the BE domain language; does not redefine it. See `_brief.md` and the BE
> `03-domain-framing` for PROJ (pending — M2). Data shapes derive from the BA data-model
> (draft v0.1.0) and the prototype `data-model.ts` / `mock-data.json`.

## 1. Ubiquitous Language

| Term (pt-BR) | Meaning in the UI |
|---|---|
| Projeto (ProjetoEditorial) | The editorial project — **the aggregate PROJ owns**. Holds `nome`, `status`, `criadoEm`, `ultimaAtividade`, `editora`. |
| Status do projeto | Lifecycle state: `rascunho`, `em_composicao`, `publicado`, `com_erros`. Server-authoritative. |
| Biblioteca de projetos | The library grid — every project of the active empresa. |
| Card de projeto | One project's summary tile: name, author/editora, counters, last-activity date, status badge. |
| Badge de status | Colour-coded chip: Rascunho (neutral) · Em andamento (info) · Válido/Publicado (success) · Erros (error) · N avisos (warning). |
| Abrir | Resume a project at its stage-appropriate route (stage-aware navigation). |
| Novo projeto | Start a new project → enters IMP at `/upload`. |
| Publicação (Publicacao) | A single ePub export of a project — `epubcheckStatus`, counts, `arquivoUrl`, `criadoEm`. **Read, not owned.** |
| Histórico de exportações | The reverse-chronological list of `Publicacao` for one project. |
| Versão atual | The most recent export in the history. |
| epubcheck status | `valido`, `avisos`, `erros_criticos`, `pendente` — drives the history row icon/label and whether a download is offered. |
| Empresa / Editora | Tenant scoping the whole library. |

## 2. View Models (draft)

### ProjectCardVM (part of T02 — `/biblioteca-de-projetos`)

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | project id (used by `track` and navigation) |
| `nome` | `string` | project title |
| `editora` | `string` | author / editora display line |
| `status` | `'rascunho' \| 'em_composicao' \| 'publicado' \| 'com_erros'` | drives badge + card accent + stage-aware "Abrir" |
| `totalCapitulos` | `number` | counter (from `Manuscrito`, when available) |
| `totalImagens` | `number` | counter (from `Manuscrito`, when available) |
| `ultimaAtividade` | `string \| null` | last-activity datetime; `'—'` when null |
| `canDownload` | `boolean` (computed) | `status='publicado'` AND a valid latest `Publicacao` with `arquivoUrl` |

### LibraryVM (T02)

| Field | Type | Notes |
|---|---|---|
| `projetos` | `ProjectCardVM[]` | the grid |
| `status` | `'loading' \| 'ready' \| 'empty' \| 'error'` | drives skeleton / grid / empty-state / error |
| `empresaNome` | `string` | header subtitle ("N projeto(s) · Editora Aetós") |

### PublicationRowVM (part of T08 — `/download-e-historico`)

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | publicacao id (`track`) |
| `criadoEm` | `string` | export datetime (formatted pt-BR) |
| `epubcheckStatus` | `'valido' \| 'avisos' \| 'erros_criticos' \| 'pendente'` | icon + label + colour |
| `totalErros` | `number` | shown on error rows |
| `totalAvisos` | `number` | shown on warning rows |
| `erros` | `string \| null` | one-line error summary when present |
| `arquivoUrl` | `string \| null` | download target; absent → no download affordance |
| `isCurrent` | `boolean` (computed) | first row = "versão atual" |

### HistoryVM (T08)

| Field | Type | Notes |
|---|---|---|
| `projeto` | `{ id; nome; status }` | header |
| `autor` | `string` | from `Metadados` |
| `publicacoes` | `PublicationRowVM[]` | reverse-chronological |
| `status` | `'loading' \| 'ready' \| 'empty' \| 'error'` | parse readiness of the history list |

## 3. UI Events

| Event | Screen | Effect |
|---|---|---|
| `openLibrary()` | T02 | on entry: `GET` projects for the active empresa; `status → loading → ready/empty/error` |
| `newProject()` | T02 | navigate to IMP `/upload` |
| `openProject(id, status)` | T02 | stage-aware navigation (draft→IMP, in-composition→COMP, published→T08) |
| `quickDownload(id)` | T02 | resolve latest valid `Publicacao` URL and download (published cards only) |
| `retryLibrary()` | T02 | re-issue the list request from `error` |
| `openHistory(projetoId)` | T08 | `GET` project + publication history; hydrate `HistoryVM` |
| `downloadVersion(publicacaoId)` | T08 | resolve `arquivoUrl` (or fetch a signed URL) and trigger browser download |
| `newExport()` | T08 | navigate to PUB `/exportacao-e-validacao` with `projetoId` |
| `adjustMetadata()` / `adjustLayout()` | T08 | navigate to COMP (`/config` / `/editor-de-layout-preview`) with `projetoId` |

## 4. State Transitions (UI level)

```
LIBRARY (T02):
  loading --list ready, N>0--> ready
  loading --list ready, N=0--> empty
  loading --list error----->  error --retryLibrary--> loading
  ready|empty --empresa switch--> loading (re-fetch, cancel previous)
  ready --openProject(status)--> (stage-aware navigate)

HISTORY (T08):
  loading --history ready, N>0--> ready
  loading --history ready, N=0--> empty (project has no exports yet)
  loading --error--> error --retry--> loading
  ready --downloadVersion(valid)--> ready (browser download; row unchanged)
  ready --newExport--> (navigate PUB)
```

## 5. Invariants (client-side)

- The library is **always empresa-scoped**: switching empresa always re-fetches; a stale list from
  the previous empresa is never shown.
- Project `status` is **read-only in PROJ** — PROJ never mutates it; status changes come from
  IMP/COMP/PUB via the backend and are reflected on re-fetch (ADR-PROJ-001).
- A download affordance is rendered **only** when a `Publicacao` has an `arquivoUrl` (valid /
  warning versions); `pendente` and `erros_criticos` rows show no download button.
- "Abrir" is **stage-aware** and never dead-ends: every project status maps to a reachable route.
- The history is **reverse-chronological**; exactly one row is marked "versão atual" (the first).
- Card counters (`totalCapitulos` / `totalImagens`) degrade gracefully to `0`/`—` when the
  `Manuscrito` summary is not yet available (e.g. a `rascunho` before import completes).
