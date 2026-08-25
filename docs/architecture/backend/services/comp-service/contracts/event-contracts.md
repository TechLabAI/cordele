# Event Contracts — comp-service (Composição)

**Module:** COMP · **Transport:** in-process only (`stack.messaging.enabled = false`) — NestJS event
emitter; there is **no broker** in the POC. Events are best-effort, same-process notifications dispatched
**after commit**, never a cross-process delivery guarantee (doc 04 *Async vs Sync*).

**Governing docs:** doc 04, `_brief.md` (anchor event), local
`adr/ADR-002-layout-overrides-not-manuscript-mutation.md`.

The domain anchor event is **`CompositionUpdated`** (Composição atualizada — the metadata and/or layout of
a project's composition changed and the book is ready to be re-previewed or exported). It is realized
concretely as the two events below; there is no separate `CompositionUpdated` payload on the wire (M1.5
decision: anchor = `CompositionUpdated`, realized by `MetadataUpdated` / `LayoutUpdated`).

---

## 1. Published events

### 1.1 `MetadataUpdated` (realizes the anchor)

Raised **after** a project's `Metadados` is committed (create, field update, or cover
upload/removal). Best-effort notification (e.g. preview/UI refresh, PROJ read-model author hint); it is
**not** a status driver — COMP never changes `projeto_editorial.status` (local ADR-002 boundary).

- **Name / channel:** `composition.metadata-updated` (in-process event name)
- **Timing:** after DB commit of the `metadados` upsert (post-commit hook), within the same request.
- **Payload:**

```json
{
  "eventId": "uuid",
  "occurredAt": "2026-08-25T14:31:46Z",
  "projetoId": "uuid",
  "hasCover": true,
  "atualizadoEm": "2026-08-25T14:31:46Z"
}
```

- **Headers / context:** `correlationId` (= `X-Correlation-Id`), `empresa` (tenant slug), `principalId` —
  carried via `EmpresaContext`, not in the payload body.

**EARS:**

- `WHEN a project's Metadados is committed, THE SYSTEM SHALL publish exactly one MetadataUpdated carrying
  the projetoId and atualizadoEm.`
- `IF the transaction rolls back, THEN THE SYSTEM SHALL NOT publish MetadataUpdated.`
- `THE SYSTEM SHALL NOT change projeto_editorial.status when publishing MetadataUpdated.`

### 1.2 `LayoutUpdated` (realizes the anchor)

Raised **after** a project's `ConfiguracaoLayout` (and its overrides) is committed. Same best-effort,
non-status-driving semantics as §1.1.

- **Name / channel:** `composition.layout-updated`
- **Timing:** after DB commit of the `configuracao_layout` + `layout_override` upsert.
- **Payload:**

```json
{
  "eventId": "uuid",
  "occurredAt": "2026-08-25T14:40:00Z",
  "projetoId": "uuid",
  "totalOverrides": 3,
  "atualizadoEm": "2026-08-25T14:40:00Z"
}
```

**EARS:**

- `WHEN a project's ConfiguracaoLayout is committed, THE SYSTEM SHALL publish exactly one LayoutUpdated
  carrying the projetoId, totalOverrides and atualizadoEm.`
- `IF the transaction rolls back, THEN THE SYSTEM SHALL NOT publish LayoutUpdated.`

---

## 2. Consumed events

**None.** COMP does **not** subscribe to `ManuscriptImported` or any other event. Default
`Metadados`/`ConfiguracaoLayout` are created **lazily** on first access, not eagerly on import (api-contract
§0 D-M): with `messaging.enabled = false` there is no reliable bus to trigger eager creation, and the brief
gives COMP no event consumption. COMP reads the manuscript content tree only **synchronously in-process**
via `ManuscriptContentPort` (read-only) when it needs it (preview, override validation) — a port call, not
an event subscription.

**EARS:**

- `THE SYSTEM SHALL NOT create or mutate composition data in response to any consumed event; defaults are
  materialized lazily on the first PUT (D-M).`

---

## 3. Idempotency

- **No broker ⇒ no redelivery** in the POC: each event fires once, in-process, after commit. There is no
  at-least-once delivery to deduplicate against.
- Every event carries a unique `eventId`; a consumer moved out-of-process (post-POC broker) MUST treat
  `eventId` as the idempotency key under at-least-once delivery.
- **Composition idempotency** (distinct from event idempotency): `PUT` metadata / `PUT` layout are
  idempotent upserts keyed by `projetoId` (api-contract §1); re-sending an identical body is a safe no-op
  that still returns the current representation. Whether a no-op re-emits the event is left to the
  scaffold; the payload carries `atualizadoEm` so consumers can dedup.

**EARS:**

- `WHERE a downstream consumer is moved out-of-process (post-POC), THE SYSTEM SHALL allow it to deduplicate
  by eventId under at-least-once delivery.`

## 4. Payload versioning

- Events are versioned by **additive evolution**: new optional fields only; no field removed or retyped
  without a new event name (`composition.layout-updated.v2`).
- Current version: `v1` (implicit). Consumers MUST ignore unknown fields.

**EARS:**

- `IF a new required datum is needed on an event, THEN THE SYSTEM SHALL introduce a new versioned event
  name rather than break the existing payload.`

## 5. Post-POC async note

If a broker is enabled later (doc 04 *Future async path*), cover processing or export could become
event-driven, and `MetadataUpdated`/`LayoutUpdated` could carry cross-process. The event names and
payloads here stay compatible; only dispatch timing/transport changes. COMP still never drives status by
event — status remains PROJ's, moved only through PROJ's ports (M1 handoff / ADR-002).
