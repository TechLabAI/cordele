# Event Catalog — comp-service (Composição)

Transport: **in-process** (NestJS event emitter; `messaging.enabled = false`). No broker. The domain anchor
event `CompositionUpdated` is realized concretely as the two events below (M1.5 decision). Full payloads
and EARS in `contracts/event-contracts.md`.

| Event | Type | Channel (in-process) | Payload | Known consumers |
|---|---|---|---|---|
| `MetadataUpdated` (realizes `CompositionUpdated`) | published | `composition.metadata-updated` | [event-contracts §1.1](../contracts/event-contracts.md) — `projetoId, hasCover, atualizadoEm` | (none required in POC; preview/UI refresh, PROJ author read-model hint) |
| `LayoutUpdated` (realizes `CompositionUpdated`) | published | `composition.layout-updated` | [event-contracts §1.2](../contracts/event-contracts.md) — `projetoId, totalOverrides, atualizadoEm` | (none required in POC; preview/UI refresh) |

**Consumed:** none. COMP does **not** subscribe to `ManuscriptImported` or any other event; default
`Metadados`/`ConfiguracaoLayout` are materialized **lazily** on the first `PUT` (api-contract §0 D-M), and
the manuscript content tree is read synchronously in-process via `ManuscriptContentPort` (read-only), not
by observing events. COMP never changes `projeto_editorial.status` (local ADR-002).
