# Event Contracts — pub-service (Publicação)

**Module:** PUB · **Transport:** in-process only (`stack.messaging.enabled = false`) — NestJS event
emitter; there is **no broker** in the POC. Events are best-effort, same-process notifications dispatched
**after commit**, never a cross-process delivery guarantee (doc 04, doc 02 §Cross-cutting). They are
**not** the mechanism that changes project status — that is the synchronous `AdvanceProjetoStatusUseCase.advanceTo`
call inside the build job (api-contract §7.2 / D-P). The events only notify read-model / UI refresh.

**Governing docs:** doc 03 (Domain Events), `adr/ADR-002-async-build-status-machine.md`,
`adr/ADR-003-epubcheck-validation-port.md`.

---

## 1. Published events

Both realize the domain anchor event **`EpubGenerated`** (an ePub build completed and was scored by
epubcheck), split by outcome.

### 1.1 `PublicationSucceeded` (anchor — success arm)

Raised **after** a `Publicacao` reaches `publicado` and is committed (epubcheck verdict `valido` or
`avisos`). The artifact is stored and downloadable.

- **Name / channel:** `publication.succeeded` (in-process event name)
- **Timing:** after DB commit of the terminal `publicacao` row and after `advanceTo(publicado)` returns,
  within the build job's request context.
- **Payload:**

```json
{
  "eventId": "uuid",
  "occurredAt": "2026-08-25T15:05:00Z",
  "publicacaoId": "uuid",
  "projetoId": "uuid",
  "editoraId": "uuid",
  "sequencia": 2,
  "epubcheckStatus": "avisos",
  "totalAvisos": 2
}
```

- **Headers / context:** `correlationId` (= `X-Correlation-Id`), `empresa` (tenant slug), `principalId` —
  carried via `EmpresaContext`, not in the payload body.

**EARS:**

- `WHEN a Publicacao reaches publicado and is committed, THE SYSTEM SHALL publish exactly one
  PublicationSucceeded carrying the publicacaoId, projetoId, sequencia and epubcheckStatus.`
- `IF the transaction rolls back, THEN THE SYSTEM SHALL NOT publish PublicationSucceeded.`

### 1.2 `PublicationFailed` (anchor — failure arm)

Raised **after** a `Publicacao` reaches `com_erros` and is committed (epubcheck verdict `erros_criticos`,
or an irrecoverable assembly error). No artifact is downloadable; a failed build is a first-class recorded
outcome, not a discarded error (doc 01 core promise).

- **Name / channel:** `publication.failed`
- **Payload:**

```json
{
  "eventId": "uuid",
  "occurredAt": "2026-08-25T15:05:00Z",
  "publicacaoId": "uuid",
  "projetoId": "uuid",
  "editoraId": "uuid",
  "sequencia": 3,
  "epubcheckStatus": "erros_criticos",
  "totalErros": 4,
  "resumoErro": "4 erros críticos de validação ePub (RSC-005, OPF-014)"
}
```

**EARS:**

- `WHEN a Publicacao reaches com_erros and is committed, THE SYSTEM SHALL publish exactly one
  PublicationFailed carrying the counts and a resumoErro.`
- `THE SYSTEM SHALL record the com_erros Publicacao regardless of whether any consumer handles the event
  (the failure is persisted, not only signalled).`

---

## 2. Consumed events

**None in the PUB context.** Publication is a source of events, not a subscriber, in the POC. It does not
consume `ManuscriptImported`, `MetadataUpdated` or `LayoutUpdated` — it **reads** IMP/COMP synchronously
through in-process query ports at export time (`integration-contracts.md`), not via events
(`messaging.enabled=false`; the brief gives PUB no event consumption).

---

## 3. Idempotency

- **No broker ⇒ no redelivery** in the POC: each event fires once, in-process, after commit.
- Every event carries a unique `eventId`; consumers that later become out-of-process (post-POC broker)
  MUST treat `eventId` as the idempotency key under an at-least-once assumption.
- **Build idempotency** (distinct from event idempotency): the export trigger is idempotent while a build
  is in flight (at most one non-terminal `Publicacao` per project — D-R; `data-model.md`
  `uq_publicacao_projeto_inflight`). A completed build is never re-run; re-export creates a new attempt.

**EARS:**

- `WHERE a downstream consumer is moved out-of-process (post-POC), THE SYSTEM SHALL allow it to deduplicate
  by eventId under at-least-once delivery.`

---

## 4. Payload versioning

- Events are versioned by **additive evolution**: new optional fields only; no field is removed or retyped
  without a new event name (`publication.succeeded.v2`).
- Current version: `v1` (implicit). Consumers MUST ignore unknown fields.

**EARS:**

- `IF a new required datum is needed on an event, THEN THE SYSTEM SHALL introduce a new versioned event name
  rather than break the existing payload.`

---

## 5. Post-POC async note

If a broker is enabled later, the build could be dispatched as a command message and status **pushed** to
clients (superseding the poll loop, D-N) — because the boundary is port-based, that is an
adapter/orchestration change, not a domain change (doc 04). The event names and payloads stay
compatible; only dispatch/transport moves out-of-process. `advanceTo` would still be the status-change
mechanism (the event remains a notification).
