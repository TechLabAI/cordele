# SPEC-03 — View Models — IMP (Importação) — Frontend

> Signals-first (no NgRx). Each VM is a TypeScript `type`/`record` of `Signal`s exposed by a facade
> via `.asReadonly()`; derived fields are `computed()`. Shapes mirror `api-contract.md` §6
> (`ManuscritoDetail`, `ContentTree`) and doc 03. **Do not** redefine BE types — reference them.

## 1. `UploadVM` (T03 — `/imp/upload`)

```ts
type UploadPhase = 'idle' | 'uploading' | 'parsing' | 'done' | 'error';

// project binding is mutually exclusive (api-contract §0 D-C)
type ProjectBinding =
  | { kind: 'create';   projetoTitulo: string }   // flat /upload
  | { kind: 'existing'; projetoId: string };      // nested /projetos/:id/importar

interface UploadVM {
  nome: Signal<string>;               // project title; required when kind='create'
  file: Signal<File | null>;
  fileName: Signal<string>;
  binding: Signal<ProjectBinding | null>;
  state: Signal<UploadPhase>;
  progressPct: Signal<number>;        // 0–100; meaningful only WHILE state='uploading'
  errorMessage: Signal<string>;       // inline validation / upload error
  canSubmit: Signal<boolean>;         // computed (see invariants)
  manuscritoId: Signal<string | null>;// set from the 201 body; drives navigation to T04
  projetoId: Signal<string | null>;   // echoed from the 201 body (created or existing)
}
```

**UI events exposed:** `nomeChanged(value)`, `fileSelected(file)` / `fileDropped(file)`,
`submitImport()`, `resetUpload()`, `retry()`.

**Computed rules:**

- `canSubmit = state ∈ {idle,error}` **and** a valid `file` is selected **and**
  (`binding.kind='existing'` **or** (`binding.kind='create'` **and** `nome.trim().length >= 3`)).
- `progressPct` is only rendered while `state='uploading'`; on `parsing` the indicator is
  **indeterminate** (ADR-IMP-001 — the parse phase has no linear progress).

## 2. `StructureReviewVM` (T04 — `/imp/manuscritos/:manuscritoId/revisao`)

```ts
type ReviewStatus = 'loading' | 'ready' | 'error';

interface CapituloVM { n: number; titulo: string; }

// derived from ContentTree unparsed nodes (api-contract §6.2/§6.3)
interface TrechoVM {
  id: string;
  pagina: number | null;              // sourceLocation.paragraphIndex (docx) / line (md); null if absent
  capitulo: string;                   // owning chapter title, or "—"
  tipo: string;                       // human label for UnparsedSegment.reason (see §4)
  descricao: string;                  // plain-language description of the reason
  ignorado: boolean;                  // client-side, optimistic
}

interface StructureReviewVM {
  status: Signal<ReviewStatus>;
  manuscrito: Signal<{ nomeArquivo: string; formato: 'docx' | 'markdown' }>;
  totalCapitulos: Signal<number>;
  totalImagens: Signal<number>;
  trechosNaoParseados: Signal<number>;
  capitulos: Signal<CapituloVM[]>;
  pendencias: Signal<TrechoVM[]>;
  // computed
  canConfirm: Signal<boolean>;        // always true when status='ready' (editor decides)
  hasZeroChapters: Signal<boolean>;   // totalCapitulos === 0
  pendingCount: Signal<number>;       // pendencias.filter(p => !p.ignorado).length
  confirming: Signal<boolean>;        // in-flight confirm
}
```

**UI events exposed:** `ignoreFragment(id)`, `confirmStructure()`, `reimport()`, `toggleToc()`.

## 3. Mapping from `ManuscritoDetail` → VMs

- `StructureReviewVM.totalCapitulos/totalImagens/trechosNaoParseados` bind **directly** to the
  counters in the `201` body (contract guarantees they equal the counts derivable from `estrutura`).
- `capitulos` = `estrutura.chapters.map((c, i) => ({ n: i + 1, titulo: c.title }))`.
- `pendencias` = every `Block` with `type='unparsed'` across all chapters/sections, flattened in
  document order, each mapped to a `TrechoVM` (reason → `tipo`+`descricao` via §4, `sourceLocation`
  → `pagina`, owning chapter title → `capitulo`).

## 4. `UnparsedSegment.reason` → user-facing label (closed enum, api-contract §6.3)

| `reason` | `tipo` (pt-BR) | `descricao` (pt-BR) |
|---|---|---|
| `complex_table` | "Tabela complexa" | "Uma tabela com estrutura além de uma grade simples não pôde ser convertida." |
| `math_equation` | "Equação" | "Uma equação matemática (OMML/LaTeX/MathML) não pôde ser estruturada." |
| `nested_footnote` | "Nota aninhada" | "Uma nota de rodapé aninhada ou com referência cruzada não pôde ser mapeada." |
| `unknown_docx_style` | "Estilo desconhecido" | "Um estilo do documento fora do mapa de estilos não pôde ser interpretado." |
| `unsupported_markup` | "Marcação não suportada" | "Um trecho de Markdown/HTML fora do subconjunto suportado não pôde ser convertido." |
| `embedded_object` | "Objeto incorporado" | "Um objeto incorporado (OLE, gráfico, SmartArt, arquivo) não pôde ser convertido." |
| `other` | "Não classificado" | "Um trecho que o conversor não conseguiu classificar foi preservado como está." |

The mapping is total: an unknown/future reason falls back to the `other` row so the panel never
renders a blank label (defence in depth against contract drift).

## Criterios de aceite (EARS)

- `WHILE the upload VM state is 'idle' or 'error', THE SYSTEM SHALL keep the import button disabled until a valid file is selected and, for the create binding, a project name of at least 3 trimmed characters is present [imp-submit-disabled].`
- `WHILE the upload VM state is 'uploading', THE SYSTEM SHALL render a determinate progress value bound to progressPct [imp-sync-post].`
- `WHILE the upload VM state is 'parsing', THE SYSTEM SHALL render an indeterminate "analisando estrutura…" indicator and SHALL NOT display a numeric progress percentage [imp-parse-indeterminate].`
- `WHILE the review VM status is 'loading', THE SYSTEM SHALL render skeleton counters and SHALL NOT render the confirm action as enabled [imp-deeplink-single-get].`
- `WHEN the review VM is hydrated, THE SYSTEM SHALL show totalCapitulos, totalImagens and trechosNaoParseados exactly as returned by the manuscript response [imp-counters-match].`
- `WHILE the review VM status is 'ready', THE SYSTEM SHALL keep "Confirmar estrutura" enabled even when trechosNaoParseados is greater than zero [imp-confirm-pending].`
- `IF totalCapitulos is zero when the editor confirms, THEN THE SYSTEM SHALL require an explicit warning acknowledgement before proceeding [imp-zero-chapters].`
- `THE SYSTEM SHALL always render every unparsed fragment and SHALL NOT hide or auto-dismiss the pending counter [imp-pending-always].`
- `WHERE an unparsed reason is outside the known enum, THE SYSTEM SHALL label it as "Não classificado" rather than render a blank label [imp-reason-fallback].`
