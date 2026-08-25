<!-- OUTPUT-SCHEMA
- Ubiquitous Language
- Aggregates and Entities
- Domain Events
- State Transitions
- Invariants
-->

# 03 — Initial Domain Framing

**Module:** PUB — Publicação · **Bounded context:** Publication

## Ubiquitous Language

| Term | Meaning in this context |
|---|---|
| **Publicação** (`Publicacao`) | One attempt to generate an ePub 3 for a project: its status, the epubcheck report, and (on success) a reference to the produced `.epub`. The owned aggregate. |
| **Geração** | The act of assembling the ePub from manuscript + metadata + layout. |
| **Validação** | Running epubcheck on the assembled package; its verdict decides the outcome. |
| **epubcheck** | The W3C ePub validator; the external authority on ePub 3 conformance. |
| **Artefato** | The produced `.epub` binary, stored behind `FileStoragePort` and referenced by the publication. |
| **Relatório de validação** | The structured epubcheck output (messages: error/warning/info with location), persisted on the publication. |
| **Publicado** | Terminal success status: epubcheck passed, artifact stored, downloadable. |
| **Com erros** | Terminal failure status: epubcheck (or assembly) failed; report present, no artifact offered. |
| **Sequência** | Monotonic per-project number distinguishing successive publication attempts (history ordering). |

## Aggregates and Entities

- **`Publicacao`** *(aggregate root)* — `id`, `projetoId` (references PROJ, not owned), `status`
  (`gerando | validando | publicado | com_erros`), `sequencia` (per project), `relatorioValidacao`
  (epubcheck messages), `artefatoRef` (storage reference, present only when `publicado`), `resumoErro`
  (short failure summary when `com_erros`), `iniciadaEm`, `concluidaEm`.
- **`ValidationMessage`** *(value object, part of the report)* — `severity` (`error | warning | info`),
  `code`, `message`, `location` (file + line/col when available). A collection of these forms
  `relatorioValidacao`.
- **`PublicationStatus`** *(value object)* — encodes the legal transition table; no adapter or controller
  re-implements the lifecycle.

Read-only, referenced but **not** owned by this context and never persisted here as a copy:
`ProjetoEditorial` (PROJ), the manuscript content tree (IMP), `Metadados` / `ConfiguracaoLayout` (COMP).
These are read in-process at assembly time only.

## Domain Events

Dispatched in-process (NestJS event emitter), after commit, best-effort — notifications, not the driver of
project status (that is the synchronous `advanceTo` call):

- **`PublicationRequested`** — a build was enqueued (`Publicacao` created in `gerando`).
- **`PublicationSucceeded`** — epubcheck passed; artifact stored; publication `publicado`. *(concrete form
  of the anchor `EpubGenerated`)*
- **`PublicationFailed`** — epubcheck or assembly failed; publication `com_erros`. *(concrete form of the
  anchor `EpubGenerated`)*

Anchor event: **`EpubGenerated`** (Publicação gerada) — a build completed and was scored, realized as
`PublicationSucceeded` or `PublicationFailed`.

## State Transitions

`Publicacao.status` state machine:

```
(create) ─► gerando ─► validando ─┬─► publicado     (epubcheck valid → artifact stored → advanceTo publicado)
                                   └─► com_erros     (epubcheck invalid OR assembly/build error → advanceTo com_erros)
gerando ───────────────────────────► com_erros       (assembly/build error before validation)
```

- `publicado` and `com_erros` are terminal for that `Publicacao`; a new attempt creates a **new**
  `Publicacao` with the next `sequencia` (attempts are immutable history, never overwritten).
- Each terminal transition triggers exactly one `PROJ.advanceTo` request (`publicado` or `com_erros`),
  which is itself idempotent on the PROJ side.

## Invariants

1. A `Publicacao` reaches `publicado` **only** after epubcheck returns a passing verdict — the assembler
   succeeding is not sufficient.
2. `artefatoRef` is set **iff** `status = publicado`; a `com_erros` publication never carries a
   downloadable artifact.
3. A `com_erros` publication always carries a non-empty `relatorioValidacao` or `resumoErro`.
4. At most one `Publicacao` per `projetoId` is non-terminal (`gerando`/`validando`) at a time.
5. `sequencia` is strictly increasing per `projetoId`; existing publications are never mutated after
   reaching a terminal state (append-only history).
6. Publication never writes `projeto_editorial`, `manuscrito`, `metadados` or `configuracao_layout`; it
   reads them in-process and requests project status changes through PROJ's port.
7. All reads, writes and stored artifacts are scoped to the active `EmpresaContext`.
