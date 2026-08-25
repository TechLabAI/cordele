# Integration Contracts — comp-service (Composição)

**Module:** COMP · **Governing ADR:** shared `docs/architecture/backend/adr/ADR-001-hexagonal-node.md`
(every integration is an infrastructure adapter behind a domain port).

Composition has **no third-party API, no broker, no AI provider** (doc 04; `ai.hasAi=false`,
`messaging.enabled=false`). Its integrations are entirely **in-process cross-context** calls inside the
modular monolith, plus one **infrastructure** port for the cover binary. The inbound ports COMP **exports**
for PUB and PROJ to call, and the outbound ports COMP **imports** to read the manuscript and to store the
cover, are all DI-wired NestJS providers in the same request/transaction (ADR-001).

---

## 1. Inbound ports exported by COMP (other contexts call these)

COMP's public surface (ADR-001 / D-I). No other context reads the `metadados` / `configuracao_layout`
tables directly; they call these ports, injected by DI token.

### 1.1 `GetMetadadosUseCase` — read metadata for export (called by PUB, D-I / G2)

- **Signature:** `get(projetoId): Promise<MetadadosRead | null>`
- **Caller:** PUB, at export time, to embed editorial identity in the ePub.
- **Returns:** the persisted `Metadados` (api-contract §6.1 minus `materialized`): `titulo, autor, isbn,
  idioma, categoria, capaUrl, editoraNome, atualizadoEm`; `null` if the project has no composed metadata.
- **Fallback:** none — PUB decides how to handle `null` (an export needs at least `titulo`/`autor`/`idioma`;
  PUB validates presence, api-contract §7.1 / R4).
- **EARS:** `WHEN PUB calls get(projetoId) within an EmpresaContext, THE SYSTEM SHALL return the project's
  persisted Metadados or null, and never expose the metadados table.`

### 1.2 `GetConfiguracaoLayoutUseCase` — read layout for export (called by PUB, D-I / G2)

- **Signature:** `get(projetoId): Promise<LayoutRead | null>`
- **Caller:** PUB, at export time, to drive the ePub stylesheet.
- **Returns:** the persisted `ConfiguracaoLayout` (api-contract §6.2): typography + margins + heading sizes
  + **honoured, non-stale** overrides only (each `{ referenciaNo, tipo:'imagem', alinhamento, ordem }`);
  `null` if the project has no layout. Overrides whose `referenciaNo` no longer resolves in the current
  content tree are **excluded** (stale — R2/G4); PUB never receives a dangling override.
- **Honoured parameters (fixed, G2):** exactly the set in api-contract §7.3. PUB reproduces these
  parameters; it does not honour blank-page inserts (`em-branco` is deferred, D-H) or any rendered snapshot.
- **EARS:**
  - `WHEN PUB calls get(projetoId), THE SYSTEM SHALL return the layout with only non-stale image-alignment
    overrides, or null.`
  - `THE SYSTEM SHALL restrict the returned parameters to the honoured set (api-contract §7.3).`

### 1.3 `ProjectMetadataPort` — batched author lookup (called by PROJ, library/detail)

- **Signature:** `metadata(projetoIds): Promise<Map<projetoId, { autor?: string }>>`
- **Caller:** PROJ, composing the T02 library and T08 detail cards (proj integration-contracts §2.2).
- **Behaviour:** batched by `projetoId` set (no N+1); `autor` absent until COMP has composed metadata (a
  `rascunho` project has none).
- **Fallback (PROJ side):** on COMP unavailability PROJ degrades (`autor=null`, `degraded=true`).
- **EARS:** `WHEN PROJ calls metadata(projetoIds), THE SYSTEM SHALL return the composed autor per project
  in the active empresa, omitting projects with no metadata yet.`

### 1.4 `CompositionErasurePort` — LGPD erasure (called by PROJ, G3 / D-G)

- **Signature:** `purge(projetoId): Promise<void>`
- **Caller:** PROJ, step 2 of the leaf-first deletion cascade (proj integration-contracts §3).
- **Behaviour:** idempotently deletes the project's `metadados` and `configuracao_layout` rows (overrides
  cascade via FK) **and** the cover binary in `FileStoragePort`. Purging already-absent data is a no-op.
- **EARS:**
  - `WHEN PROJ purges a project, THE SYSTEM SHALL delete COMP rows and the cover binary and return without
    error even if some or all were already absent (idempotent).`

---

## 2. Outbound ports imported by COMP

### 2.1 `ManuscriptContentPort` (from IMP) — read-only content tree (D-K / ADR-002)

- **Signatures:**
  - `getContentTree(projetoId): Promise<{ manuscritoId, estrutura } | null>` — the read-only content tree
    for the project's latest manuscript, used to assemble the preview-context (api-contract §4.7).
  - `nodeExists(projetoId, referenciaNo): Promise<boolean>` — validate that an override's `referenciaNo`
    resolves in the current tree (override write validation, api-contract §4.6).
- **Owner:** IMP. COMP **reads** the manuscript, **never writes** it (ADR-002). In-process DI, same request.
- **Fallback:** if IMP has no manuscript for the project, `getContentTree` returns `null` → preview responds
  `409 urn:cordele:comp:manuscript-missing`; `nodeExists` returns `false` → override write rejected `422`.
- **EARS:**
  - `THE SYSTEM SHALL read the manuscript content tree only through ManuscriptContentPort (read-only) and
    never mutate IMP data.`
  - `WHEN validating a layout override, THE SYSTEM SHALL confirm referenciaNo via nodeExists before persist.`

### 2.2 `FileStoragePort` (infrastructure) — cover binary (ADR-003 / D-L)

- **Signatures:**
  - `put(key, stream, contentType): Promise<{ url }>` — stream the cover to disk (POC) / S3 (prod), return
    the storage reference stored as `capaUrl`.
  - `delete(url): Promise<void>` — remove a cover object (replacement cleanup / erasure).
- **Adapters:** local-disk (POC) and S3-compatible (prod), selected by configuration; the domain depends
  only on the port. Mirrors IMP's storage-port pattern (one storage abstraction across IMP and COMP).
- **EARS:** `THE SYSTEM SHALL stream the cover binary to FileStoragePort and store only the returned
  reference (capaUrl) in the row.`

---

## 3. Summary table

| Integration | Direction | Port | Transport | Fallback |
|---|---|---|---|---|
| Metadata read (export) | inbound (COMP exports) | `GetMetadadosUseCase` | in-process DI | return null |
| Layout read (export) | inbound | `GetConfiguracaoLayoutUseCase` | in-process DI | return null (non-stale only) |
| Author lookup (library) | inbound | `ProjectMetadataPort` | in-process DI | omit project (PROJ degrades) |
| Composition erasure | inbound | `CompositionErasurePort` | in-process DI | idempotent no-op |
| Manuscript read (preview/validate) | outbound (COMP imports) | `ManuscriptContentPort` (IMP) | in-process DI | 409 / 422 |
| Cover storage | outbound | `FileStoragePort` (disk/S3) | infra adapter | reject upload |

> **Scaffold note:** the outbound `ManuscriptContentPort` is the COMP→IMP contract. If COMP is scaffolded
> before IMP's content-query port exists, provide a thin stub (`getContentTree` → a small fixture tree,
> `nodeExists` → true) so COMP compiles and the preview/override paths exercise; the real implementation
> lands with IMP. The inbound ports (§1) are the surface PROJ (`ProjectMetadataPort`, `CompositionErasurePort`)
> and PUB (`GetMetadados`, `GetConfiguracaoLayout`) already expect — provide them so PROJ's library/detail
> and cascade, and PUB's export, wire cleanly.
