<!-- OUTPUT-SCHEMA
- Status
- Contexto
- Decisão
- Consequências
-->

# ADR-002 — Project status authority via the AdvanceProjetoStatusUseCase port

## Status
accepted (2026-08-25) · Scope: the Projects (PROJ) context of Cordelê and every context that changes a
project's state

## Contexto
A `ProjetoEditorial` moves through `rascunho → em_composicao → publicado | com_erros`, but the events
that should move it happen in *other* contexts: Import finishes a manuscript, Publication finishes an
export. There are two ways to keep status in sync. Either each context writes `projeto_editorial.status`
itself (or PROJ subscribes to their events and infers status), or PROJ owns the status and other
contexts *ask* it to change.

Forces: with `messaging.enabled = false` there is no reliable event bus, so an event-subscription model
would rely on best-effort in-process notifications to drive authoritative state — fragile. Letting IMP
and PUB write status directly creates multiple writers and status drift (risk R1), and duplicates the
legal-transition rules in every context. The IMP↔PROJ integration already recorded during Import (D-C)
established the opposite: IMP calls a PROJ use case and never writes the table.

## Decisão
**PROJ is the single authority over project status.** The status is changed only through the exported
inbound port `AdvanceProjetoStatusUseCase.advanceTo({ projetoId, targetStatus })`, which:

1. loads the project within the caller's `EmpresaContext`;
2. validates the transition against the legal-transition table held in the `ProjectStatus` value object;
3. is **idempotent** — advancing to a status the project has already reached or passed is a successful
   no-op;
4. applies the change, persists it, and emits `ProjectStatusChanged` only on an actual change.

Import calls it with `em_composicao`; Publication with `publicado` or `com_erros`. No context other than
PROJ writes `projeto_editorial` (D-C). PROJ does **not** drive its own lifecycle by subscribing to
IMP/PUB events; its events are notifications for read-model/UI listeners.

## Consequências
Positive: one writer, one place for the transition rules, no status drift; deterministic and testable
in-process; idempotency makes retried calls safe without a broker's delivery guarantees; the contract is
explicit and already honored by IMP.

Negative / trade-offs: IMP and PUB are synchronously coupled to PROJ (latency and deployment coupling,
risk R7) — accepted in the modular-monolith POC (ADR-001). If a broker is later enabled, `advanceTo` can
be fronted by a command message while keeping the same validation and idempotency; that revision
supersedes this ADR rather than editing it.
