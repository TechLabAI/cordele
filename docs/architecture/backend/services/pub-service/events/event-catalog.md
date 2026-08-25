# Event Catalog — pub-service (Publicação)

Transport: **in-process** (NestJS event emitter; `messaging.enabled = false`). No broker. Full payloads
and EARS in `contracts/event-contracts.md`. Both events are best-effort notifications dispatched after
commit; they do **not** change project status (that is the synchronous `advanceTo` call — D-P).

| Event | Type | Channel (in-process) | Payload | Known consumers |
|---|---|---|---|---|
| `PublicationSucceeded` (anchor) | published | `publication.succeeded` | [event-contracts §1.1](../contracts/event-contracts.md) — `publicacaoId, projetoId, editoraId, sequencia, epubcheckStatus, totalAvisos` | (none required in POC; available for read-model/UI refresh, audit/observability) |
| `PublicationFailed` (anchor) | published | `publication.failed` | [event-contracts §1.2](../contracts/event-contracts.md) — `publicacaoId, projetoId, editoraId, sequencia, epubcheckStatus, totalErros, resumoErro` | (none required in POC; available for audit/observability) |

**Consumed:** none — Publication is a source of events, not a subscriber, in the POC. It reads IMP/COMP
in-process at export time (query ports), not via events.
