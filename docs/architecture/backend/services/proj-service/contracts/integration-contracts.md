# Integration Contracts — proj-service (Projetos)

**Module:** PROJ · **Governing ADR:** shared `docs/architecture/backend/adr/ADR-001-hexagonal-node.md`
(every integration is an infrastructure adapter behind a domain port).

Projects has **no third-party API, no broker, no AI provider** (doc 04). Its integrations are entirely
**in-process cross-context** calls inside the modular monolith: the inbound ports PROJ **exports** for IMP
and PUB to call, and the outbound ports PROJ **imports** to read from IMP/COMP/PUB and to erase their data
on deletion. All are DI-wired NestJS providers in the same request/transaction (ADR-001).

---

## 1. Inbound ports exported by PROJ (other contexts call these)

PROJ's only public surface (ADR-001). No other context reads `projeto_editorial` or PROJ providers
directly; they call these ports, injected by DI token.

### 1.1 `CreateProjetoEditorialUseCase` — create a project (called by IMP, D-C)

- **Signature:** `create({ titulo }): Promise<{ projetoId }>`
- **Caller:** IMP, in the create-and-upload flow (`projetoTitulo`), imp integration-contracts §3.
- **Behaviour:** creates a `ProjetoEditorial` in `rascunho` for the caller's `EmpresaContext`, emits
  `ProjectCreated`, returns the new id. `titulo` sets `projeto_editorial.nome` (the REST body calls the
  same field `nome`; the param name `titulo` is kept for IMP binding compatibility).
- **EARS:** `WHEN IMP calls create({ titulo }) within an EmpresaContext, THE SYSTEM SHALL create a
  rascunho project owned by that empresa and return its projetoId.`

### 1.2 `ProjetoEditorialLookup` — validate a project id (called by IMP, D-C)

- **Signature:** `exists(projetoId): Promise<boolean>`
- **Caller:** IMP, to validate an incoming `projetoId` before binding a manuscript.
- **Behaviour:** tenant-scoped existence check; returns `false` for a project of another empresa (never
  reveals cross-tenant existence).
- **EARS:** `WHEN IMP calls exists(projetoId), THE SYSTEM SHALL return true only if the project exists in
  the active empresa, false otherwise.`

### 1.3 `AdvanceProjetoStatusUseCase` — status authority (called by IMP and PUB, ADR-002 / D-D)

- **Signature:** `advanceTo({ projetoId, targetStatus }): Promise<{ projetoId, newStatus, changed }>`
- **Callers:** IMP with `em_composicao` (confirm-estrutura, imp §8.2); PUB with `publicado` | `com_erros`
  after an export.
- **Behaviour:** loads the project in the caller's `EmpresaContext`, validates against the legal-transition
  table (api-contract §7), applies + persists + appends `projeto_status_historico` + emits
  `ProjectStatusChanged` **only** on an actual change; idempotent no-op otherwise (`changed=false`).
- **Agreement (binding):**
  - PROJ validates `rascunho → em_composicao` (IMP) and `em_composicao|publicado|com_erros → publicado|com_erros` (PUB).
  - Advancing to an already-reached status, or `advanceTo(em_composicao)` on a post-composition project,
    is a successful no-op — **PROJ never regresses** via `advanceTo` (regression is `reopen`, §1.4).
  - Illegal transition (e.g. `rascunho → publicado`) throws `IllegalStatusTransitionError`; the caller
    surfaces it (IMP maps to `422 urn:cordele:imp:status-advance-failed`).
  - Callers MUST call the port at most once per triggering action; the port is idempotent.
- **EARS:**
  - `WHEN a caller advances to a legal targetStatus that differs from the current status, THE SYSTEM SHALL
    apply it, emit ProjectStatusChanged, and return changed=true.`
  - `IF the transition is illegal, THEN THE SYSTEM SHALL throw IllegalStatusTransitionError and change
    nothing.`

### 1.4 `ReopenProjectForRevisionUseCase` — the one backward edge (G6)

- **Signature:** `reopen({ projetoId }): Promise<{ projetoId, newStatus, changed }>`
- **Callers:** the editor via REST `POST /api/proj/projetos/{id}/reopen` (T08 "Ajustar metadados/layout");
  optionally COMP when an edit on a published project requires re-opening composition.
- **Behaviour:** `publicado|com_erros → em_composicao`; idempotent no-op if already `em_composicao`;
  rejects from `rascunho`. Emits `ProjectStatusChanged` on an actual change.
- **EARS:** `WHEN reopen is called on a publicado or com_erros project, THE SYSTEM SHALL set it to
  em_composicao and emit ProjectStatusChanged; IF the project is in rascunho, THEN THE SYSTEM SHALL reject.`

---

## 2. Outbound read ports imported by PROJ (read composition)

Behind these domain ports, infrastructure adapters call the in-process **query ports** exported by IMP,
COMP and PUB. Domain and application layers never name IMP/COMP/PUB directly. All are **batched by
projetoId set** so the library (T02) never does an N+1 read (api-contract §6.4, SPEC-03).

### 2.1 `ManuscriptSummaryPort` (from IMP)

- **Signature:** `summaries(projetoIds): Promise<Map<projetoId, ManuscriptSummary>>`
- **Returns:** per project, the **latest** manuscript summary — `manuscritoId, nomeArquivo, formato,
  totalCapitulos, totalImagens, trechosNaoParseados, criadoEm` (imp api-contract §6.4).
- **Fallback:** on IMP unavailability, omit the project's counts (card shows 0 / detail `manuscriptSummary=null`,
  `degraded=true`) — never fails the read.

### 2.2 `ProjectMetadataPort` (from COMP)

- **Signature:** `metadata(projetoIds): Promise<Map<projetoId, { autor?: string }>>`
- **Returns:** per project, the composed metadata needed by T02/T08 (author). `autor` is absent until COMP
  has composed metadata (a rascunho project has none — prototype "Contos Urbanos / em andamento").
- **Fallback:** on COMP unavailability, `autor=null`, `degraded=true`.

### 2.3 `PublicationHistoryPort` (from PUB) — ADR-003 / D-E / G2

- **Signatures:**
  - `history(projetoId): Promise<PublicacaoHistoryItem[]>` — full history, newest first (T08 list).
  - `latest(projetoIds): Promise<Map<projetoId, PublicacaoHistoryItem>>` — latest per project (T02 badge).
  - `signedDownloadUrl(publicacaoId): Promise<{ arquivoUrl, expiresAt }>` — mint a short-TTL signed URL
    to the ePub artifact (PUB signs via its own `FileStoragePort`). PROJ **never** streams bytes (D-F).
- **Field set (fixed, closes G2):** `publicacaoId, projetoId, epubcheckStatus (valido|avisos|erros_criticos|pendente),
  totalErros, totalAvisos, erros (nullable), arquivoUrl (null unless valido|avisos), criadoEm`
  (api-contract §6.3).
- **Ordering:** `criadoEm` descending.
- **Fallback:** on PUB unavailability, `history=[]` / `latest` omits the project, `degraded=true`; the
  project's own status still renders (ADR-003 consequence).
- **EARS:**
  - `WHEN PROJ composes project detail, THE SYSTEM SHALL read publications from PublicationHistoryPort and
    never from a PROJ-owned table.`
  - `WHEN a download URL is requested for a valido/avisos publication, THE SYSTEM SHALL obtain a signed URL
    from PublicationHistoryPort.signedDownloadUrl and return it without proxying the artifact.`

---

## 3. Outbound erasure ports imported by PROJ (LGPD cascade) — D-G / G3

On `DELETE /api/proj/projetos/{id}` PROJ orchestrates a **leaf-first, idempotent** purge before deleting
the identity row (SPEC-11). Each context owns deletion of its **own rows and stored binaries**; the DB
`ON DELETE CASCADE` FKs are the integrity backstop, not the erasure mechanism (binaries are not in the DB).

| Order | Port (imported) | Owner | Purges |
|---|---|---|---|
| 1 | `PublicationErasurePort.purge(projetoId)` | PUB | `Publicacao` rows **+** ePub/PDF artifacts in storage |
| 2 | `CompositionErasurePort.purge(projetoId)` | COMP | `Metadados` / `ConfiguracaoLayout` rows |
| 3 | `ManuscriptErasurePort.purge(projetoId)` | IMP | `manuscrito` rows **+** binaries/images in storage |
| 4 | (PROJ itself) | PROJ | `projeto_editorial` (+ `projeto_status_historico` via FK cascade) |

- **EARS:**
  - `WHEN PROJ deletes a project, THE SYSTEM SHALL invoke the erasure ports in leaf-first order (PUB, COMP,
    IMP) before deleting projeto_editorial.`
  - `THE SYSTEM SHALL treat each erasure port as idempotent (purging already-absent data is a no-op).`
  - `IF any erasure port fails, THEN THE SYSTEM SHALL abort before deleting projeto_editorial and surface
    502 (urn:cordele:proj:erasure-failed).`

---

## 4. Summary table

| Integration | Direction | Port | Transport | Fallback |
|---|---|---|---|---|
| Create project | inbound (PROJ exports) | `CreateProjetoEditorialUseCase` | in-process DI | none (reject) |
| Validate project | inbound | `ProjetoEditorialLookup` | in-process DI | none |
| Advance status | inbound | `AdvanceProjetoStatusUseCase` | in-process DI | throw on illegal |
| Reopen revision | inbound | `ReopenProjectForRevisionUseCase` | in-process DI | throw on illegal |
| Manuscript summary | outbound (PROJ imports) | `ManuscriptSummaryPort` (IMP) | in-process DI | degrade (counts=0) |
| Project metadata | outbound | `ProjectMetadataPort` (COMP) | in-process DI | degrade (autor=null) |
| Publication history + signed URL | outbound | `PublicationHistoryPort` (PUB) | in-process DI | degrade (history=[]) |
| Publication erasure | outbound | `PublicationErasurePort` (PUB) | in-process DI | abort delete (502) |
| Composition erasure | outbound | `CompositionErasurePort` (COMP) | in-process DI | abort delete (502) |
| Manuscript erasure | outbound | `ManuscriptErasurePort` (IMP) | in-process DI | abort delete (502) |

> **Scaffold note:** the outbound query/erasure ports above are the PROJ→IMP/COMP/PUB contract. If PROJ is
> scaffolded before COMP/PUB exist, provide thin stubs (empty summaries/history, no-op idempotent purge) so
> PROJ compiles and the library/detail degrade cleanly; the real implementations land with those modules.
> The inbound ports (§1) mirror the stubs IMP already provisions against (imp integration-contracts §3, §5).
