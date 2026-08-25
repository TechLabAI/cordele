# Event Contracts — proj-service (Projetos)

**Module:** PROJ · **Transport:** in-process only (`stack.messaging.enabled = false`) — NestJS event
emitter; there is **no broker** in the POC. Events are best-effort, same-process notifications dispatched
**after commit**, never a cross-process delivery guarantee (doc 04 *Async vs Sync*, ADR-002).

**Governing docs:** doc 03 (Domain Events), doc 04, `adr/ADR-002-project-status-authority.md`.

---

## 1. Published events

### 1.1 `ProjectCreated` (anchor event)

Raised **after** a `ProjetoEditorial` is persisted and committed in `rascunho`. It anchors every
downstream manuscript, composition and publication — a project identity now exists to bind to.

- **Name / channel:** `project.created` (in-process event name)
- **Timing:** after DB commit of the `projeto_editorial` row (post-commit hook), within the same request
  (including the in-process create called by IMP in create-and-upload, D-C).
- **Payload:**

```json
{
  "eventId": "uuid",
  "occurredAt": "2026-08-25T14:00:00Z",
  "projetoId": "uuid",
  "editoraId": "uuid",
  "nome": "Romance das Cidades",
  "status": "rascunho"
}
```

- **Headers / context:** `correlationId` (= `X-Correlation-Id`), `empresa` (tenant slug), `principalId`
  — carried via `EmpresaContext`, not in the payload body.

**EARS:**

- `WHEN a ProjetoEditorial is committed, THE SYSTEM SHALL publish exactly one ProjectCreated event
  carrying the projetoId, editoraId, nome and status=rascunho.`
- `IF the transaction rolls back, THEN THE SYSTEM SHALL NOT publish ProjectCreated.`

### 1.2 `ProjectStatusChanged`

Raised **only on an actual status change** (never on an idempotent no-op — ADR-002, api-contract §7),
after the new status and its `projeto_status_historico` row are committed. It is the notification
downstream read-models/telemetry may observe; it is **not** the mechanism that drives status.

- **Name / channel:** `project.status-changed`
- **Timing:** after DB commit of the status update + history row.
- **Payload:**

```json
{
  "eventId": "uuid",
  "occurredAt": "2026-08-25T14:31:46Z",
  "projetoId": "uuid",
  "editoraId": "uuid",
  "statusDe": "em_composicao",
  "statusPara": "publicado",
  "solicitadoPor": "pub"
}
```

- `solicitadoPor ∈ {imp, pub, comp, editor, system}` (the requesting context).

**EARS:**

- `WHEN advanceTo or reopen actually changes the status, THE SYSTEM SHALL publish exactly one
  ProjectStatusChanged carrying statusDe, statusPara and solicitadoPor.`
- `IF a transition is an idempotent no-op (unchanged status), THEN THE SYSTEM SHALL NOT publish
  ProjectStatusChanged.`
- `THE SYSTEM SHALL publish statusPara identical to the persisted projeto_editorial.status.`

### 1.3 `ProjectDeleted`

Raised **after** the orchestrated cross-context erasure succeeds and the `projeto_editorial` row is
removed (D-G, SPEC-11). Emitted for audit/observability; no consumer is required in the POC.

- **Name / channel:** `project.deleted`
- **Payload:**

```json
{
  "eventId": "uuid",
  "occurredAt": "2026-08-25T15:00:00Z",
  "projetoId": "uuid",
  "editoraId": "uuid"
}
```

**EARS:**

- `WHEN a project and all its cross-context data are erased, THE SYSTEM SHALL publish exactly one
  ProjectDeleted event.`
- `IF the erasure aborts before deleting projeto_editorial, THEN THE SYSTEM SHALL NOT publish
  ProjectDeleted.`

---

## 2. Consumed events

**None.** PROJ does **not** drive its lifecycle by subscribing to IMP/PUB events (ADR-002): status moves
only through the `advanceTo` / `reopen` inbound ports called synchronously in-process. This deliberately
supersedes the annotation in `imp-service/events/event-catalog.md` that labelled PROJ a consumer of
`ManuscriptImported` "to advance status" — with `messaging.enabled = false` there is no reliable bus to
carry authoritative state, so IMP advances status by the **explicit port call** in its `confirm-estrutura`
action (imp api-contract §8.2), not by PROJ observing an event. PROJ MAY observe `ManuscriptImported` as
a best-effort read-model/telemetry hint, but never as the status driver.

**EARS:**

- `THE SYSTEM SHALL NOT change projeto_editorial.status in response to any consumed event; status changes
  only through the advanceTo/reopen inbound ports.`

---

## 3. Idempotency

- **No broker ⇒ no redelivery** in the POC: each event fires once, in-process, after commit. There is no
  at-least-once delivery to deduplicate against.
- Every event carries a unique `eventId`; consumers that later become out-of-process (post-POC broker)
  MUST treat `eventId` as the idempotency key under at-least-once delivery.
- **Status idempotency** (distinct from event idempotency) is enforced at the source: `advanceTo`/`reopen`
  emit `ProjectStatusChanged` **only** when the status actually changes (api-contract §7), so retried
  in-process calls never emit duplicate events.

**EARS:**

- `WHERE a downstream consumer is moved out-of-process (post-POC), THE SYSTEM SHALL allow it to
  deduplicate by eventId under at-least-once delivery.`

## 4. Payload versioning

- Events are versioned by **additive evolution**: new optional fields only; no field is removed or
  retyped without a new event name (`project.status-changed.v2`).
- Current version: `v1` (implicit). Consumers MUST ignore unknown fields.

**EARS:**

- `IF a new required datum is needed on an event, THEN THE SYSTEM SHALL introduce a new versioned event
  name rather than break the existing payload.`

## 5. Post-POC async note

If a broker is enabled later (doc 04 *Future async path*, ADR-001 A5), `advanceTo` could be fronted by a
command message and history materialized from PUB events behind the same ports. The event names and
payloads here stay compatible; only dispatch timing/transport changes. Authoritative status remains
port-driven, not event-driven (ADR-002).
