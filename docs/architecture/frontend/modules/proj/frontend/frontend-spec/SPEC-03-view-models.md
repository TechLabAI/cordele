# SPEC-03 — View Models — PROJ (Projetos) — Frontend

> View-models are Signal-based records exposed by the facades (`libs/proj/data-access`). Field shapes are
> reconciled with `api-contract.md` §6 (`ProjetoCard`, `ProjetoDetail`, `PublicacaoHistoryItem`). The
> **badge derivation** and **degraded** rules below are Specs decisions that close doc 06 gaps.

## 1. `LibraryVM` (T02 — `/biblioteca-de-projetos`)

```ts
type LibraryStatus = 'loading' | 'ready' | 'empty' | 'error';
type ProjetoStatus = 'rascunho' | 'em_composicao' | 'publicado' | 'com_erros';
type EpubcheckStatus = 'valido' | 'avisos' | 'erros_criticos' | 'pendente';

// one library card, mapped from api-contract §6.2 ProjetoCard
interface ProjetoCardVM {
  id: string;
  nome: string;
  autor: string | null;             // null until COMP metadata exists (degraded → null)
  status: ProjetoStatus;            // authoritative project status
  totalCapitulos: number;           // 0 while no manuscript / IMP degraded
  totalImagens: number;
  ultimoEpubcheckStatus: EpubcheckStatus | null;  // null if never exported / PUB degraded
  ultimaAtividadeEm: string;        // ISO-8601, drives ordering
  // computed
  badge: StatusBadgeVM;             // derived, see §badge rule
  canQuickDownload: boolean;        // ultimoEpubcheckStatus ∈ {valido, avisos} && flag proj.quickDownload
  openTarget: 'imp' | 'comp' | 'history';  // stage-aware resolver (libs/proj/navigation)
}

interface LibraryVM {
  status: Signal<LibraryStatus>;
  projects: Signal<ProjetoCardVM[]>;   // ordered by ultimaAtividadeEm desc
  isEmpty: Signal<boolean>;            // status==='ready' && projects().length===0 → renders 'empty'
  degraded: Signal<boolean>;           // a cross-context read port was down (counters/author/badge partial)
  empresaNome: Signal<string>;
}
```

**UI events exposed:** `onNewProject()` (→ IMP `/upload`), `onOpen(card)` (→ stage-aware route),
`onQuickDownload(card)` (→ resolve signed URL, open in new tab), `onRetry()` (re-issue the list).

**Computed rules:**
- `isEmpty` distinguishes an empty-but-loaded library (`empty` state, dashed CTA) from a still-loading
  one (`loading` skeletons) — never render the empty state while loading (no flicker).
- `openTarget` never yields a dead end: every one of the four statuses maps to exactly one route.

## 2. `HistoryVM` (T08 — `/projetos/:projetoId/historico`)

```ts
type HistoryStatus = 'loading' | 'ready' | 'error' | 'not-found';

interface ProjectHeaderVM {
  id: string;
  nome: string;
  autor: string | null;
  status: ProjetoStatus;
  badge: StatusBadgeVM;
  canReopen: boolean;               // status ∈ {publicado, com_erros} && flag proj.reopen
  canNewExport: boolean;            // status ∈ {em_composicao, publicado, com_erros}
}

interface PublicacaoRowVM {
  publicacaoId: string;
  projetoId: string;
  epubcheckStatus: EpubcheckStatus;
  totalErros: number;
  totalAvisos: number;
  erros: string | null;             // human-readable summary, shown for erros_criticos
  criadoEm: string;                 // ISO-8601
  isCurrent: boolean;               // first row (newest) → "versão atual" chip
  // computed
  canDownload: boolean;             // arquivoUrl != null (epubcheckStatus ∈ {valido, avisos})
  statusLabel: string;              // "Válido · N aviso(s)" | "N erro(s) crítico(s)" | "Pendente"
}

interface HistoryVM {
  status: Signal<HistoryStatus>;
  header: Signal<ProjectHeaderVM | null>;
  publications: Signal<PublicacaoRowVM[]>;   // criadoEm desc
  reopenPending: Signal<boolean>;            // a POST .../reopen is in flight (disables reopen CTAs)
  degraded: Signal<boolean>;                 // PUB read degraded → publications=[] with a notice
}
```

**UI events exposed:** `onReopenMetadata()` / `onReopenLayout()` (→ `POST .../reopen` then COMP route),
`onNewExport()` (→ PUB `/exportacao-e-validacao`), `onDownload(row)` (→ resolve signed URL, open in new
tab), `onBack()` (→ `/biblioteca-de-projetos`).

**Computed rules:**
- `isCurrent` is true only for the newest publication (`$first`); it drives the "versão atual" chip.
- `canDownload` is derived **solely** from `arquivoUrl != null`; the FE never re-derives downloadability
  from the status string alone (the contract already nulls `arquivoUrl` for `erros_criticos`/`pendente`).
- `reopenPending` gates the header CTAs so a double-click cannot fire two reopen writes.

## 3. Status-badge derivation (`StatusBadgeVM`) — closes doc 06 gap

The library gap ("raw `ProjetoEditorial.status` vs a projection folding in the latest
`Publicacao.epubcheckStatus`") is **resolved by api-contract §6.2**: the badge is derived.

```ts
type BadgeTone = 'draft' | 'progress' | 'valid' | 'warn' | 'error' | 'pending';

interface StatusBadgeVM {
  tone: BadgeTone;      // → design-token colour family (no inline oklch in production)
  label: string;        // pt-BR: "Rascunho" | "Em andamento" | "Válido" | "N aviso(s)" | "Erros" | "Pendente"
  icon: string;         // material symbol name
}

// derivation (SPEC decision, api-contract §6.2):
//   status === 'rascunho'                              → tone 'draft'    "Rascunho"
//   status === 'em_composicao'                         → tone 'progress' "Em andamento"
//   otherwise (a publication exists) fold epubcheck:
//     ultimoEpubcheckStatus === 'valido'               → tone 'valid'    "Válido"
//     ultimoEpubcheckStatus === 'avisos'               → tone 'warn'     "N aviso(s)"
//     ultimoEpubcheckStatus === 'erros_criticos'       → tone 'error'    "Erros"
//     ultimoEpubcheckStatus === 'pendente' | null      → tone 'pending'  "Pendente"
```

## Criterios de aceite (EARS)

- `WHILE the library VM status is 'loading', THE SYSTEM SHALL render CLS-safe skeleton cards and SHALL NOT render the empty state [proj-loading-skeleton].`
- `WHEN the list responds with zero projects, THE SYSTEM SHALL set status to 'empty' and render the dashed empty-state CTA to IMP /upload [proj-empty-state].`
- `THE SYSTEM SHALL order the library cards by ultimaAtividadeEm descending [proj-library-order].`
- `WHERE a project has a publication, THE SYSTEM SHALL derive the card badge from ultimoEpubcheckStatus; otherwise THE SYSTEM SHALL derive it from the project status [proj-badge-derivation].`
- `WHERE a publication's arquivoUrl is null, THE SYSTEM SHALL set the row canDownload to false and SHALL NOT render a "Baixar" affordance for it [proj-row-nondownloadable].`
- `WHILE a reopen request is in flight, THE SYSTEM SHALL keep reopenPending true and disable the "Ajustar metadados" and "Ajustar layout" actions [proj-reopen-pending].`
- `WHERE the header status is neither publicado nor com_erros, THE SYSTEM SHALL set canReopen to false and hide the reopen actions [proj-reopen-visibility].`
- `IF a cross-context read is degraded, THEN THE SYSTEM SHALL keep degraded true, render each project's own identity and status, and mark the missing fields as temporarily unavailable [proj-degraded-fields].`
