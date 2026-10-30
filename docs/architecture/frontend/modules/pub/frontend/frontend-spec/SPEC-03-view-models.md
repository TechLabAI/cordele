# SPEC-03 — View Models — PUB (Publicação) — Frontend

> Signals-first (no NgRx). Each VM is a TypeScript `type`/`record` of `Signal`s exposed by a facade
> via `.asReadonly()`; derived fields are `computed()`. Shapes mirror `api-contract.md` §6
> (`PublicacaoStatus` §6.1, `PublicacaoHistoryItem` §6.2, `PublicationStats` §6.3) and doc 03.
> **Do not** redefine BE types — reference them.

## 1. `ExportVM` (T07 — `/projetos/:projetoId/exportacao-e-validacao`)

```ts
type ExportPhase = 'gerando' | 'valido' | 'erros' | 'error';
type EpubcheckStatus = 'valido' | 'avisos' | 'erros_criticos' | 'pendente';
type BuildStatus = 'gerando' | 'validando' | 'publicado' | 'com_erros';

interface AvisoVM {                     // non-blocking warning row (T07 <details>)
  code: string;
  msg: string;
  local: string;
}

interface ExportVM {
  projetoId: Signal<string>;            // route param; scopes the export
  phase: Signal<ExportPhase>;           // UI state (see mapping below)
  buildStatus: Signal<BuildStatus | null>; // api-contract PublicacaoStatus.status (D-Q build machine)
  publicacao: Signal<PublicacaoVM | null>; // terminal record once the build resolves
  summary: Signal<EpubSummaryVM | null>;   // KPI grid for a valid export
  avisos: Signal<AvisoVM[]>;            // non-blocking warnings (see §5 gap — may be empty in MVP)
  // computed
  verdict: Signal<EpubcheckStatus | null>; // = publicacao.epubcheckStatus
  podeBaixar: Signal<boolean>;          // epubcheckStatus ∈ {valido, avisos} AND arquivoDisponivel
  totalErros: Signal<number>;
  totalAvisos: Signal<number>;
  resumoErro: Signal<string | null>;    // non-null only when com_erros (api-contract §6.1)
}
```

**Phase mapping (build machine + verdict → UI phase, D-Q):**

| api-contract `status` | `epubcheckStatus` | `ExportVM.phase` |
|---|---|---|
| `gerando` / `validando` | `pendente` | `gerando` (indeterminate progress; honour `Retry-After`) |
| `publicado` | `valido` / `avisos` | `valido` (`podeBaixar = true`) |
| `com_erros` | `erros_criticos` | `erros` (`podeBaixar = false`, download blocked) |
| — (request/network failure before a record exists) | — | `error` (retry) |

**UI events exposed:** `requestExport()`, `resumeExport()`, `toggleWarnings()`, `baixar()`,
`adjustLayout()`, `retry()`.

**Computed rules:**

- `podeBaixar = verdict ∈ {valido, avisos}` **and** `publicacao.arquivoDisponivel === true`. It is a
  `computed()` over the server record — **never** a manually toggled flag (R4).
- There is **no numeric progress**: `PublicacaoStatus` (§6.1) carries no percentage — the `gerando`
  phase is always **indeterminate** (D-N; the prototype's 60% bar is dropped, R-proto).
- `verdict` is **rendered, not computed**: it is exactly `epubcheckStatus` from `pub-service`; the UI
  never derives válido vs erros client-side (ADR-PUB-001).

## 2. `PublicacaoVM` (shared by T07 result + T08 rows)

```ts
interface PublicacaoVM {
  id: string;                           // publicacaoId
  projetoId: string;
  epubcheckStatus: EpubcheckStatus;     // the verdict
  totalErros: number;                   // epubcheck error count
  totalAvisos: number;                  // epubcheck warning count
  erros: string | null;                 // short error summary (T08 row); ~ resumoErro on T07
  arquivoUrl: string | null;            // download reference; null for erros_criticos/pendente
  arquivoDisponivel: boolean;           // T07 §6.1 flag; true only when status=publicado
  criadoEm: string;                     // ISO; rendered dd/MM/yyyy HH:mm (pt-BR)
  // computed per row
  podeBaixar: boolean;                  // epubcheckStatus ∈ {valido, avisos}
}
```

- On **T07** the record comes from `GET .../publicacoes/{publicacaoId}/status` (§6.1
  `PublicacaoStatus`); `arquivoDisponivel` drives `podeBaixar` and the download step goes through §4.4.
- On **T08** rows come from `GET .../publicacoes` (§6.2 `PublicacaoHistoryItem`); `arquivoUrl` may be a
  placeholder resolved via §4.4 or an inlined signed URL — the download endpoint is the authoritative
  minting path. `arquivoUrl === null` ⇒ non-downloadable ⇒ the row renders "inválido".

## 3. `EpubSummaryVM` (T07 — KPI grid for a valid export)

```ts
interface EpubSummaryVM {
  tamanho: string | null;               // human file size (e.g. "1,4 MB"), formatted from tamanhoBytes
  paginas: number | null;               // always null — see contract note below
  capitulos: number | null;
  imagens: number | null;
}
```

> **Contract note (R5, resolved — ADR-004 / api-contract D-S, 2026-09-01):** `PublicacaoStatus` (§6.1)
> now exposes `tamanhoBytes`/`totalCapitulos`/`totalImagens`, non-null iff `status=publicado`; the FE maps
> them to `tamanho` (formatted, e.g. `formatBytes(tamanhoBytes)`), `capitulos`, `imagens` — each tile
> still hides on `null` (build in flight / `com_erros`), same `pub-kpi-omit-missing` behaviour as before,
> now only transient rather than permanent. `paginas` stays `null` **forever, by design**: ePub reflowable
> has no fixed pagination, so the BE contract will never carry a pages field (product decision, not a
> pending gap). No longer tracked in `contracts/backend-api-cross-link.md` §6 / SPEC-08 as an open item.

## 4. `HistoryVM` (T08 — `/projetos/:projetoId/download-e-historico`)

```ts
type HistoryStatus = 'loading' | 'ready' | 'empty' | 'error';

interface HistoryVM {
  status: Signal<HistoryStatus>;
  projeto: Signal<{ id: string; nome: string; status: string; editora: string }>; // from PROJ
  meta: Signal<{ autor: string }>;      // from COMP Metadados (header subtitle)
  publicacoes: Signal<PublicacaoVM[]>;  // newest-first (server-ordered, §4.3)
  stats: Signal<PublicationStats | null>; // KPI cards (api-contract §6.3, §4.5)
  // computed
  versaoAtualId: Signal<string | null>; // publicacoes[0]?.id — the "versão atual" marker
}
```

`PublicationStats` (`{ total, publicadas, comAvisos, comErros, emAndamento, ultimoStatus,
ultimoEpubcheckStatus, ultimaPublicacaoEm }`) is consumed as-is from api-contract §6.3.

**UI events exposed:** `openHistory()`, `download(id)`, `newExport()`, `adjustMetadata()`,
`backToLibrary()`, `retry()`.

## 5. Warnings detail — reconciled with the current contract

The T07 expandable warnings list wants per-warning `{ code, msg, local }` (the prototype's
`AVISOS_MOCK`). The ratified `api-contract.md` §6 exposes **counts** (`totalAvisos`) and a summary
(`resumoErro`/`erros`) but **no per-warning list endpoint** (the doc 05 DRAFT `GET .../avisos` is
**not** in the contract). In the MVP:

- The banner and the `<details>` header render the **counts** (`totalAvisos` non-blocking / `totalErros`
  blocking) and `resumoErro` — these are authoritative.
- `avisos: AvisoVM[]` stays **empty** until a BE endpoint/inlined field lands; the FE must not fabricate
  a call to a non-existent endpoint. This is a **gap for M4** (see `backend-api-cross-link.md` §6).

## Criterios de aceite (EARS)

- `WHILE the export phase is gerando, THE SYSTEM SHALL render an indeterminate progress indicator and SHALL NOT display a numeric progress percentage [pub-progress-indeterminate].`
- `WHEN the build reaches a terminal outcome, THE SYSTEM SHALL render the verdict exactly as the epubcheckStatus returned by pub-service and SHALL NOT compute válido or erros client-side [pub-verdict-rendered].`
- `WHILE the verdict is avisos, THE SYSTEM SHALL render the result as a downloadable success with a non-blocking warning caveat and SHALL NOT treat it as a failure [pub-avisos-nonblocking].`
- `THE SYSTEM SHALL enable a download affordance only when epubcheckStatus is valido or avisos and arquivoDisponivel is true, and SHALL render "inválido"/blocked otherwise [pub-gate-download].`
- `WHEN the history list is rendered, THE SYSTEM SHALL mark the newest publication (index 0) as "versão atual" and SHALL keep the server ordering unchanged [pub-versao-atual].`
- `WHERE an EpubSummary KPI is not supplied by the contract, THE SYSTEM SHALL omit that tile rather than render a fabricated value [pub-kpi-omit-missing].`
