<!-- OUTPUT-SCHEMA
- Status
- Contexto
- Decisão
- Consequências
-->

# ADR-002 — Asynchronous ePub build driving the Publicacao status machine

## Status
accepted (2026-08-25) · Scope: the Publication (PUB) context of Cordelê

## Contexto
Generating an ePub is long-running: read the manuscript tree, assemble OPF/spine/nav/XHTML/CSS, pack the
OCF container, then run epubcheck (a Java process) over it. Running that synchronously inside the HTTP
request would hold a connection open for seconds and couple the editor's UI to the whole build. There is
no broker to offload to (`messaging.enabled = false`), so any asynchrony must be in-process. The editor
also needs to *see* progress and a definitive outcome, and re-clicking "Gerar ePub" must not spawn a
second build.

Forces: block-the-request is simple but gives a poor UX and no concurrency control; a full job queue is
more than the POC needs. The domain naturally has intermediate states (`gerando`, `validando`) and
terminal states (`publicado`, `com_erros`) — a status machine is the honest model of the flow.

## Decisão
**ePub generation is an asynchronous in-process job that drives the `Publicacao` status machine.**

1. `GeneratePublicationUseCase.generate({ projetoId })` creates a `Publicacao` in `gerando`, enqueues an
   in-process build job, and returns the `publicacaoId` immediately (HTTP 202).
2. The job transitions `gerando → validando → publicado | com_erros`; the legal transitions live in the
   `PublicationStatus` value object.
3. Clients observe progress by polling `GetPublicationStatusUseCase` — the deliberate POC mechanism, since
   there is no push channel.
4. The build is **idempotent per in-flight request**: at most one non-terminal `Publicacao` exists per
   project; a re-trigger while one is `gerando`/`validando` returns the existing `publicacaoId` instead of
   starting a second job. Each *new* attempt is a new `Publicacao` with the next `sequencia`.
5. A crashed or timed-out job resolves the `Publicacao` to `com_erros` (with a summary), never leaving it
   stuck in a non-terminal state.

## Consequências
Positive: the trigger returns instantly regardless of book size; long work never blocks the request
thread; progress and outcome are observable; concurrency and double-click are handled by the single
non-terminal invariant; the status machine is a testable, explicit domain model that also feeds PROJ's
`advanceTo` at the terminal transition.

Negative / trade-offs: polling is less immediate than push and adds client chatter (accepted for the POC,
assumption A4); an in-process job shares the monolith's resources, so builds need bounded timeouts and
working directories (risk R3); without a durable queue, a full-process crash loses in-flight jobs — the
`Publicacao` remains `gerando` and is reconciled to `com_erros` on restart/timeout. If a broker is later
enabled, the job can be dispatched as a command message and status pushed to clients; the port-based
boundary makes that an adapter change, and that revision supersedes this ADR rather than editing it.
