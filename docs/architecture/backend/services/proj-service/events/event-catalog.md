# Event Catalog — proj-service (Projetos)

Transport: **in-process** (NestJS event emitter; `messaging.enabled = false`). No broker. Full payloads
and EARS in `contracts/event-contracts.md`.

| Event | Type | Channel (in-process) | Payload | Known consumers |
|---|---|---|---|---|
| `ProjectCreated` (anchor) | published | `project.created` | [event-contracts §1.1](../contracts/event-contracts.md) — `projetoId, editoraId, nome, status=rascunho` | (none required in POC; read-model/telemetry) |
| `ProjectStatusChanged` | published | `project.status-changed` | [event-contracts §1.2](../contracts/event-contracts.md) — `projetoId, editoraId, statusDe, statusPara, solicitadoPor` | (none required in POC; read-model/telemetry) |
| `ProjectDeleted` | published | `project.deleted` | [event-contracts §1.3](../contracts/event-contracts.md) — `projetoId, editoraId` | (none required in POC; audit/observability) |

**Consumed:** none. PROJ never changes status in response to an event; status moves only through the
`advanceTo` / `reopen` inbound ports (ADR-002). This supersedes the annotation in
`imp-service/events/event-catalog.md` that labelled PROJ a consumer of `ManuscriptImported`.
