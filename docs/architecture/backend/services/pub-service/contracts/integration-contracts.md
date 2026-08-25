# Integration Contracts — pub-service (Publicação)

**Module:** PUB · **Governing ADR:** shared `docs/architecture/backend/adr/ADR-001-hexagonal-node.md`
(every integration is an infrastructure adapter behind a domain port).

Publication has **no third-party API, no broker, no AI provider** (doc 04). Its integrations are: (1) two
**infrastructure** ports — `EpubValidationPort` (epubcheck, the one external tool) and `FileStoragePort`
(the `.epub` binary) — and (2) **in-process cross-context** ports: the outbound reads/calls PUB **imports**
from IMP/COMP/PROJ at export time, and the inbound query/erasure ports PUB **exports** for PROJ. All
in-process calls are DI-wired NestJS providers in the same request/transaction (ADR-001); the build job
runs inside the triggering request's `EmpresaContext`.

---

## 1. Inbound ports exported by PUB (other contexts call these)

PUB's only public surface (ADR-001). No other context reads the `publicacao` table or PUB providers
directly; they call these ports, injected by DI token. Field sets are fixed by `api-contract.md` §6.

### 1.1 `PublicationHistoryPort` — read-model over publications (called by PROJ, D-E/D-F/G2)

- **Signatures:**
  - `history(projetoId): Promise<PublicacaoHistoryItem[]>` — full history, newest first (T08 list).
  - `latest(projetoIds): Promise<Map<projetoId, PublicacaoHistoryItem>>` — latest per project (T02 badge);
    **batched** by `projetoId` set (no N+1 — proj api-contract §6.4).
  - `signedDownloadUrl(publicacaoId): Promise<{ arquivoUrl, expiresAt }>` — mint a short-TTL signed URL to
    the ePub artifact via PUB's own `FileStoragePort`. PUB (and PROJ) **never** stream bytes (D-F).
- **Field set (fixed, closes G2):** `publicacaoId, projetoId, epubcheckStatus
  (valido|avisos|erros_criticos|pendente), totalErros, totalAvisos, erros (nullable), arquivoUrl (null
  unless valido|avisos), criadoEm` (api-contract §6.2).
- **Ordering:** `criadoEm` (= `iniciada_em`) descending.
- **Fallback (PROJ side):** on PUB unavailability PROJ degrades (`history=[]` / `latest` omits the project,
  `degraded=true`) — PROJ's own status still renders (proj integration-contracts §2.3).
- **EARS:**
  - `WHEN PROJ composes project detail or the library badge, THE SYSTEM SHALL serve publications through
    PublicationHistoryPort and never expose the publicacao table.`
  - `WHEN a download URL is requested for a valido/avisos publication, THE SYSTEM SHALL return a signed URL
    from signedDownloadUrl without proxying the artifact.`
  - `IF signedDownloadUrl is called for an erros_criticos/pendente publication, THEN THE SYSTEM SHALL
    refuse (no downloadable artifact — api-contract §4.4).`

### 1.2 `PublicationErasurePort` — LGPD erasure (called by PROJ, G3/D-G)

- **Signature:** `purge(projetoId): Promise<void>`
- **Caller:** PROJ, **step 1** (leaf-first) of the deletion cascade (proj integration-contracts §3).
- **Behaviour:** idempotently deletes the project's `publicacao` rows (and `validation_message` via FK
  cascade) **and** the `.epub` artifacts in `FileStoragePort`. Purging already-absent data is a no-op.
- **EARS:**
  - `WHEN PROJ purges a project, THE SYSTEM SHALL delete PUB rows and the ePub artifacts and return without
    error even if some or all were already absent (idempotent).`

---

## 2. Outbound in-process ports imported by PUB (read composition at export)

Behind these domain ports, infrastructure adapters call the in-process ports exported by IMP, COMP and
PROJ. Domain and application layers never name IMP/COMP/PROJ directly.

### 2.1 `ManuscriptContentPort` (from IMP) — read-only content tree (assembly input)

- **Signature:** `getContentTree(projetoId): Promise<{ manuscritoId, estrutura } | null>` — the read-only
  content tree of the project's latest manuscript (imp api-contract §6.2 `ContentTree`).
- **Owner:** IMP. PUB **reads** the manuscript, **never writes** it. In-process DI, same request.
- **Use:** the `EpubBuilder` domain service walks `estrutura` (chapters → sections → paragraph/image/
  unparsed blocks) to emit XHTML content documents, the spine and the nav. Image blocks resolve their
  `storageKey` through `FileStoragePort` (§3.2) to embed the binary in the OCF package.
- **Fallback:** if IMP has no manuscript for the project, `getContentTree` returns `null` → the export
  pre-flight responds `409 urn:cordele:pub:manuscript-missing` and enqueues nothing (api-contract §7.1).
- **EARS:**
  - `THE SYSTEM SHALL read the manuscript content tree only through ManuscriptContentPort (read-only) and
    never mutate IMP data.`
  - `IF getContentTree returns null at export, THEN THE SYSTEM SHALL reject the trigger with 409
    manuscript-missing.`

### 2.2 `GetMetadadosUseCase` (from COMP) — editorial metadata (assembly input, D-I)

- **Signature:** `get(projetoId): Promise<MetadadosRead | null>`
- **Returns:** persisted `Metadados` (comp api-contract §6.1 minus `materialized`): `titulo, autor, isbn,
  idioma, categoria, capaUrl, editoraNome, atualizadoEm`; `null` if never composed.
- **Use:** populates the OPF `<metadata>` (dc:title, dc:creator, dc:language, dc:identifier from `isbn`
  when present), the cover reference (`capaUrl`), and the nav title.
- **Fallback:** `null` or missing `titulo`/`autor`/`idioma` → pre-flight `422
  urn:cordele:pub:metadata-incomplete` (api-contract §7.1); PUB validates presence, COMP does not.
- **EARS:**
  - `WHEN PUB reads composition at export, THE SYSTEM SHALL obtain metadata through GetMetadadosUseCase and
    reject the export with 422 metadata-incomplete if titulo, autor or idioma is absent.`

### 2.3 `GetConfiguracaoLayoutUseCase` (from COMP) — layout for the stylesheet (assembly input, D-I)

- **Signature:** `get(projetoId): Promise<LayoutRead | null>`
- **Returns:** persisted `ConfiguracaoLayout` (comp api-contract §6.2) with **only honoured, non-stale**
  image-alignment overrides (COMP excludes dangling `referenciaNo`); `null` if never composed.
- **Use:** the `EpubBuilder` derives the ePub CSS from the honoured parameter set exactly (comp api-contract
  §7.3): `fonteCorpoFamilia`, `fonteCorpoTamanho`, `espacamentoLinha`, `margemLateral`,
  `h1Tamanho`/`h2Tamanho`/`h3Tamanho`, and per-image `alinhamento` for `tipo=imagem`. PUB honours **exactly**
  this set — no blank-page inserts (`em-branco`, deferred D-H) and no rendered snapshot.
- **Fallback:** `null` → assemble with COMP's documented defaults (comp §7.2) — a project can be exported
  with default layout; absence of layout is not a failure (only metadata is required).
- **EARS:**
  - `WHEN PUB assembles the ePub, THE SYSTEM SHALL reproduce only the honoured layout parameters (comp §7.3)
    and never honour a stale or deferred override.`
  - `WHERE no ConfiguracaoLayout exists, THE SYSTEM SHALL assemble with the documented layout defaults.`

### 2.4 `AdvanceProjetoStatusUseCase` (from PROJ) — request terminal project status (D-C/D-P)

- **Signature:** `advanceTo({ projetoId, targetStatus }): Promise<{ projetoId, newStatus, changed }>`
- **Caller:** PUB, at the end of the build job, with `targetStatus` = `publicado` (verdict valido/avisos) or
  `com_erros` (verdict erros_criticos) — mapped per D-Q. PUB **never** writes `projeto_editorial` (D-C) and
  **never** calls `reopen` (that backward edge is PROJ/editor-owned — D-P / proj integration-contracts §1.4).
- **Behaviour (PROJ side):** validates against the legal transition table (proj api-contract §7:
  `em_composicao → publicado|com_erros`, `publicado ↔ com_erros`), applies + emits `ProjectStatusChanged`
  only on an actual change, idempotent no-op otherwise. Called **at most once** per build outcome.
- **Fallback:** if `advanceTo` throws (illegal transition / PROJ unavailable), PUB **still records** the
  `Publicacao` outcome (the build result is not lost) and surfaces `502
  urn:cordele:pub:status-advance-failed` to observability; the project status can be reconciled on a
  subsequent export (api-contract §7.2).
- **EARS:**
  - `WHEN a build reaches a terminal outcome, THE SYSTEM SHALL call advanceTo exactly once with the mapped
    targetStatus (publicado|com_erros).`
  - `IF advanceTo fails, THEN THE SYSTEM SHALL persist the Publicacao outcome and surface
    status-advance-failed without discarding the build result.`

---

## 3. Infrastructure integrations (external tool + storage)

### 3.1 `EpubValidationPort` — epubcheck (the one external tool, ADR-003)

- **Port (domain):** `EpubValidationPort` — `validate(epubBytes | ocfPath): Promise<ValidationReport>`
  where `ValidationReport = { verdict, messages: { severity, code, message, location }[] }` and
  `verdict ∈ {valido, avisos, erros_criticos}` (derived from message severities — D-Q).
- **Adapter (infrastructure):** `epubcheck.adapter` runs the bundled **epubcheck** W3C validator (Java
  CLI/JAR) as a **child process** in the POC, parsing its JSON report into `ValidationReport`. A hosted
  validation service would be a different adapter behind the same port (no domain change).
- **Authority:** epubcheck's verdict is **authoritative** for `publicado` vs `com_erros` (ADR-003). The
  domain knows a *verdict*, not a Java process.
- **Determinism / SLA:** deterministic for a given package; no network. Runtime bounded by book size (runs
  in the async job, never in the request thread — ADR-002).
- **Fallback:** if epubcheck cannot run (missing JRE/JAR, crash), the build is **not** silently published —
  it is recorded `com_erros` with a `resumoErro` naming the validator failure (never ship an unvalidated
  artifact — doc 01 core promise). Operationally this is a readiness signal (SPEC-07).
- **EARS:**
  - `THE SYSTEM SHALL determine publicado vs com_erros solely from the EpubValidationPort verdict.`
  - `IF epubcheck cannot execute, THEN THE SYSTEM SHALL record the Publicacao as com_erros and never publish
    an unvalidated artifact.`

### 3.2 `FileStoragePort` — the ePub artifact + image reads (ADR-003)

- **Port (domain):** `FileStoragePort` — `put(key, stream, contentType): Promise<{ url }>`,
  `get(key): Promise<Stream>`, `delete(key): Promise<void>`,
  `signUrl(key, ttl): Promise<{ url, expiresAt }>`.
- **Adapters (infrastructure):** local-disk (POC) / S3-compatible (prod), selected by DI token — the same
  storage abstraction IMP and COMP established.
- **Key scheme:** `emp_<slug>/publicacoes/<publicacaoId>/output.epub` — always tenant-scoped from
  `EmpresaContext` (never a caller-supplied path). Image reads during assembly use IMP's keys
  (`emp_<slug>/manuscritos/<id>/img-N.<ext>`) via the same port.
- **Use:** stores the generated `.epub` on `publicado` (sets `artefato_ref`); mints the short-TTL signed
  download URL (`signUrl`); deletes artifacts on `PublicationErasurePort.purge`.
- **Fallback:** if the artifact cannot be stored after a valid build, the build is recorded `com_erros`
  with a storage-failure `resumoErro` (a `publicado` row must always have an artifact —
  `data-model.md` `chk_publicacao_artefato`).
- **EARS:**
  - `WHEN a build validates successfully, THE SYSTEM SHALL store the .epub via FileStoragePort and set
    artefato_ref before marking the Publicacao publicado.`
  - `THE SYSTEM SHALL serve the artifact only through a short-TTL signed URL, never by proxying bytes.`

---

## 4. Summary table

| Integration | Direction | Port | Transport | Fallback |
|---|---|---|---|---|
| Publication history + signed URL | inbound (PUB exports) | `PublicationHistoryPort` | in-process DI | PROJ degrades (history=[]) |
| Publication erasure | inbound | `PublicationErasurePort` | in-process DI | idempotent no-op |
| Manuscript content tree | outbound (PUB imports) | `ManuscriptContentPort` (IMP) | in-process DI | 409 manuscript-missing |
| Editorial metadata | outbound | `GetMetadadosUseCase` (COMP) | in-process DI | 422 metadata-incomplete |
| Layout configuration | outbound | `GetConfiguracaoLayoutUseCase` (COMP) | in-process DI | assemble with defaults |
| Advance project status | outbound | `AdvanceProjetoStatusUseCase` (PROJ) | in-process DI | record outcome + 502 |
| ePub validation | outbound | `EpubValidationPort` (epubcheck) | child process / JAR | com_erros (never publish) |
| Artifact storage | outbound | `FileStoragePort` (disk/S3) | infra adapter | com_erros (storage fail) |

> **Scaffold note:** the outbound ports above are the PUB→IMP/COMP/PROJ contract. If PUB is scaffolded
> before IMP/COMP/PROJ exist, provide thin stubs (`getContentTree` → a small fixture tree; `getMetadados`
> → a minimal valid metadata; `getConfiguracaoLayout` → defaults; `advanceTo` → echo `{changed:true}`) so
> PUB compiles and the export path exercises end-to-end; the real implementations land with those modules.
> The inbound ports (§1) are the surface PROJ already expects (`PublicationHistoryPort`,
> `PublicationErasurePort` — proj integration-contracts §2.3/§3) — provide them so PROJ's library/detail,
> download and LGPD cascade wire cleanly.
