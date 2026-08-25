<!-- OUTPUT-SCHEMA
- Intent
- Problem Statement
- Personas
- MVP Scope
- Out of Scope
- Architectural Principles
- Success Signals
-->

# 01 — Architectural Vision

**Module:** PUB — Publicação (Publication)
**Bounded context:** Publication

## Intent

Publication is the context that turns a prepared book into a **valid, downloadable ePub 3**. It assembles
the imported manuscript (IMP) together with the configured metadata and layout (COMP) into an ePub,
proves the result with **epubcheck**, and hands the editor a file — or a clear report of why it is not yet
valid. It is the terminal step of the Cordelê pipeline: the only context that produces an artifact a
reader can open.

## Problem Statement

Every context before Publication *prepares* a book — Import structures the manuscript, Composition gives
it identity and layout — but none produces the thing publishers actually need: a distributable ePub that
opens on real e-readers. Doing this by hand means writing OPF manifests, spine and navigation XML, packing
an OCF container, and then running the W3C validator and interpreting its output. Independent publishers
have neither the tooling nor the time. Publication removes that entire step: one action assembles and
validates the ePub 3 and returns a file, recording every attempt so a failed build is a visible,
explainable outcome rather than a dead end.

## Personas

- **Primary — Coordenador(a) Editorial (Marina, Editora Aetós pilot).** Has finished importing and
  composing a title. Clicks "Gerar ePub" (T07), watches the build validate, and either downloads the
  `.epub` or reads the epubcheck error report to know what to fix upstream. Later opens the publication
  history (T08) to re-download a prior successful build.
- **Secondary — internal dev team.** Integrates PROJ's history view against PUB's `ListPublicationsForProject`
  query port, and relies on PUB calling `PROJ.advanceTo` rather than PUB or PROJ writing each other's
  tables.

## MVP Scope

- Trigger ePub 3 generation for a project (T07), returning immediately with a `publicacaoId` to poll.
- Assemble the ePub from IMP's manuscript content tree and COMP's `Metadados` + `ConfiguracaoLayout`,
  read in-process through their query ports — Publication copies or mutates neither.
- Validate the assembled ePub with **epubcheck** behind an `EpubValidationPort`; the verdict decides
  `publicado` vs `com_erros`.
- On success: store the `.epub` behind `FileStoragePort`, set `Publicacao.status = publicado`, request
  `PROJ.advanceTo(publicado)`, expose the download.
- On failure: set `Publicacao.status = com_erros`, request `PROJ.advanceTo(com_erros)`, persist and
  surface the epubcheck report.
- Present the publication history per project (T08) as `Publicacao` records.
- Run the build as an asynchronous in-process job with a `Publicacao` status machine
  (`gerando → validando → publicado | com_erros`).
- Emit `PublicationSucceeded` / `PublicationFailed` in-process.

## Out of Scope

- Manuscript parsing / content tree (IMP); metadata and layout configuration (COMP); ownership of the
  project lifecycle and the status transition rules (PROJ — PUB only *requests* `publicado`/`com_erros`).
- Any output format other than ePub 3 (no PDF, MOBI, AZW3).
- In-app fixing of validation errors — the editor returns to COMP/IMP; Publication reports, it does not
  repair.
- E-reader preview rendering, distribution to stores (KDP/Apple Books), digital signing/DRM.
- AI-assisted remediation of validation errors (`ai.hasAi = false`).
- Owning `Manuscrito` / `Metadados` / `ConfiguracaoLayout` / `ProjetoEditorial` rows.

## Architectural Principles

1. **Nothing ships unvalidated.** A `.epub` becomes downloadable only after epubcheck accepts it; the
   validator's verdict — not the assembler's success — decides `publicado`.
2. **Read around, never copy in.** Manuscript, metadata and layout are read in-process at assembly time
   through IMP/COMP ports; Publication persists a `Publicacao` and an artifact reference, not a snapshot
   of upstream data.
3. **PROJ owns the project status; PUB owns the attempt.** PUB requests transitions via
   `AdvanceProjetoStatusUseCase.advanceTo` (D-C) and never writes `projeto_editorial`.
4. **A failed build is a result.** `com_erros` is a first-class persisted outcome with a report, not a
   discarded exception.
5. **Long work does not block requests.** The build runs asynchronously in-process; the trigger returns a
   handle and the client polls (local ADR-002).
6. **The external validator is an adapter.** epubcheck is reached behind `EpubValidationPort`; the domain
   knows a validation *verdict*, not a Java tool (local ADR-003).

## Success Signals

- An editor generates an ePub for a fully-composed project and downloads a file that opens on a
  conformant reader, with epubcheck reporting zero errors.
- An invalid input yields `com_erros` with a readable report and the project moved to `com_erros` in
  PROJ — no silent failure, no partial file offered for download.
- PROJ's history view lists every publication attempt for a project by reading PUB's query port, with no
  duplicated publication table.
- Triggering a build returns in well under a second regardless of book size; status is observable by
  polling while the job runs.
