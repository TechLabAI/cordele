# ADR-PUB-001 — Publication is server-authored and epubcheck-gated; the frontend requests generation and reflects an authoritative `Publicacao` — it never builds the ePub, decides validity, or offers a download for an invalid record

- **Status:** proposed (2026-08-25)
- **Scope:** module `pub` (Publicação) — frontend only
- **Driven by:** the pipeline ownership split — **PUB owns the export ledger (`Publicacao`) + the ePub
  artefact + the epubcheck run**, IMP owns the **immutable** `Manuscrito`, COMP owns
  `Metadados`/`ConfiguracaoLayout`, and **PROJ owns `ProjetoEditorial.status`**. PUB is the last step
  and must turn a configured project into a *validated, downloadable* ePub without becoming a
  client-side builder or a client-side validator.

## Context

PUB's export screen (T07 `exportacao-e-validacao`) shows a book being built and validated, then a
verdict: **válido** (with non-blocking warnings and an ePub summary) or **erros críticos** (download
blocked). The download and the export history live on T08 (`download-e-historico`).

The BA prototype fakes all of this to demonstrate the UX: a `setInterval` timer animates a progress
bar, a **"Simular estado"** button toggles gerando/válido/erros by hand, the KPIs are hardcoded and
the warnings come from an `AVISOS_MOCK` constant. That is a mock of the *result*, not the mechanism.
Three forces make the client-side approach wrong for production Cordelê:

1. **The ePub build and epubcheck are backend responsibilities.** Building a standards-valid ePub 3
   (assembling the OPF from `Metadados`, the stylesheet from `ConfiguracaoLayout`, the content from the
   immutable `Manuscrito`) and running **epubcheck** are server operations. A browser cannot run
   epubcheck, and must not re-implement a second, divergent notion of "valid".
2. **Validity is a trust-critical verdict.** "This ePub passed epubcheck" is the platform's core
   promise. If the FE ever *computed* válido/erros, two verdicts could disagree and the editor could
   ship an invalid file — the exact failure the product exists to prevent.
3. **There is no broker to push completion** (`messaging.enabled=false`). Generation may be
   long-running, and the FE has no event stream telling it the build finished — it must obtain the
   verdict by *asking*, honestly, not by faking a timer that "completes" on its own.

So PUB must decide **what the frontend does** versus **what the backend owns**.

## Decision

**Publication is server-authored and epubcheck-gated. The frontend *requests* generation and
*reflects* an authoritative `Publicacao`; it never builds the ePub, never decides validity, and never
offers a download for a non-valid record.**

1. **Generation is a server action.** T07 issues `POST .../publicacoes`, which creates a
   `Publicacao(pendente)` and starts the server-side build + epubcheck. The SPA does not compile,
   package or validate anything.
2. **The verdict is rendered, not computed.** `epubcheckStatus`, `totalErros`, `totalAvisos` and the
   warnings list come from `pub-service`. The FE maps `valido`/`avisos` → success banner (downloadable)
   and `erros_criticos` → error banner (download blocked); it never derives the verdict itself.
3. **Progress is honest.** The `gerando` state watches the `pendente` record via a **bounded status
   poll** (backoff, max-attempts, explicit timeout state) — or a synchronous long-request if the Specs
   contract chooses one — until a terminal `epubcheckStatus`. The prototype's `setInterval` timer and
   the "Simular estado" selector are **removed**; the progress affordance stays but is bound to real
   state, and never fabricates completion.
4. **Download is gated by validity.** The "Baixar" affordance exists **iff**
   `epubcheckStatus ∈ {valido, avisos}` **and** `arquivoUrl` is non-null (`podeBaixar` = a `computed()`
   over the record). A `erros_criticos`/`pendente` record renders "inválido"/blocked and offers the fix
   path back to COMP. The download itself streams from an **authenticated** `pub-service` URL; the SPA
   never holds or reconstructs the file bytes, and the backend enforces the same gate (defence in depth).
5. **PUB requests, never writes, the project status.** A valid export drives `em_composicao →
   publicado`, a failed one `→ com_erros`, but the transition is authored by **PROJ**
   (`AdvanceProjetoStatusUseCase`, `SolicitadoPor = pub`). PUB owns `Publicacao` only.
6. **The ledger is append-only.** Every export is a new `Publicacao`; the FE never mutates, reorders or
   deletes records — it renders them newest-first and marks index 0 "versão atual".

## Alternatives considered

1. **Build and/or validate the ePub in the browser (client-side epubcheck / a WASM validator).** —
   **rejected.** epubcheck is a JVM tool; a browser reimplementation would be a second, divergent
   validator, and shipping validity logic to the client makes the trust-critical verdict forgeable and
   unmaintainable. The build also needs server-side access to `Manuscrito`/`Metadados`/`ConfiguracaoLayout`.
2. **Keep the prototype's client-side progress timer / manual state (or an optimistic "done").** —
   rejected: it fabricates completion the backend has not reported, can show "válido" for a build that
   actually failed, and desynchronizes from the real `Publicacao`. Progress must reflect the `pendente`
   record, not a clock.
3. **Let the FE decide the verdict from raw epubcheck output.** — rejected: it duplicates the
   error/warning classification (what counts as "crítico" vs "aviso") on the client, risking a UI that
   disagrees with the recorded `epubcheckStatus`. The backend classifies once; the FE renders the label.
4. **Serve the ePub from a public/bucket URL for a simpler download.** — rejected: the artefact is
   tenant-scoped and gated by validity; a public link leaks it and bypasses the epubcheck gate.
   Download goes through an authenticated `pub-service` endpoint.
5. **Have PUB write `ProjetoEditorial.status` directly on a successful export.** — rejected: it
   duplicates PROJ's lifecycle authority and lets two modules author the same column. PUB *requests* the
   transition through PROJ (coherent with ADR-PROJ-001's server-authoritative project state).

## Consequences

- **Positive:** exactly one builder and one validator of record (`pub-service` + epubcheck), so no
  two-verdict drift; the trust-critical "valid ePub" claim is unforgeable from the client; the
  download gate is a pure `computed()` over server data and testable; the artefact stays authenticated
  and tenant-scoped; the ledger is append-only and auditable; lifecycle authority stays with PROJ.
- **Negative:** with no broker, the FE must **poll** for completion (R2) — extra requests and a bounded
  wait window; a very long build needs a graceful timeout state rather than an indefinite spinner. The
  editor cannot see *why* an error occurred beyond epubcheck's summary (no line-level remediation UI in
  the MVP).
- **Mitigations:** bounded poll with backoff + explicit timeout/"ainda gerando" state; if builds
  routinely exceed the window, add SSE/streaming in a later Spec (the posture here — server-authored,
  honest progress — does not change). Show `Publicacao.erros` + the correlation id on failure for
  support. Reconcile the KPI/warnings source and the exact generation mechanism (sync long-request vs
  poll) with `pub-service` in Specs.

## References

- RAG evidence (cordele architecture): `EpubcheckStatus` enum (`valido`/`avisos`/`erros_criticos`/
  `pendente`) and `SolicitadoPor` enum (`imp`/`pub`/`comp`/`editor`/`system`); "Prototype-first
  (D-493); Signals-first (no NgRx)".
- BA data-model (draft v0.1.0): `Publicacao` (`refs.projetoId`, `arquivoUrl?`, `epubcheckStatus`,
  `totalErros`, `totalAvisos`, `erros?`, `criadoEm`).
- Prototype: `exportacao-e-validacao.component.ts` (T07 — three states, `setInterval` timer + "Simular
  estado" selector + `AVISOS_MOCK` to be removed on promote), `download-e-historico.component.ts` (T08 —
  history + gated download).
- `../01-architectural-vision.md` (§6 principles, §7 success signals), `../02-architecture-blueprint.md`
  (§1 boundary, §3 flows), `../05-state-and-data-flow.md` (§2 endpoints, §4 writes).
- `../../comp/frontend/adr/ADR-COMP-001-preview-approximation-parameter-persistence.md` (COMP persists
  parameters, not rendered output; PUB owns final ePub fidelity — the downstream half of the same split).
- `../../proj/frontend/adr/ADR-PROJ-001-server-authoritative-project-state.md` (coherent
  server-authoritative / no-client-cache posture; PROJ owns status, PUB requests the transition).
- `docs/architecture/frontend/adr/ADR-006-module-entry-as-library.md`,
  `docs/architecture/frontend/standards/design-system-tokens.md`.
