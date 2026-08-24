# Backend Services -- Cordelê

One directory per backend service. The directory is the service's own architecture: what it owns,
what it exposes, and what it depends on. Code lives in `backend/services/<service>/`; this tree
holds the documents that govern it.

## Anatomy of a service directory

```
services/<service>/
|-- service-spec.md          # identity, ownership, bounded context, SLOs
|-- 01-overview.md           # purpose, scope, out of scope
|-- 02-domain-model.md       # aggregates, entities, invariants
|-- 03-api.md                # inbound contract (REST/gRPC), error model
|-- 04-persistence.md        # schema, migrations, retention
|-- 05-integrations.md       # outbound calls, events published and consumed
|-- 06-operations.md         # configuration, health, observability, runbook
|-- contracts/               # OpenAPI, event schemas, generated or pinned
`-- adr/                     # decisions local to this service
```

Documents 01..06 and the ADR skeleton come from `/be-architect-vision <MODULE>`. The contracts under
`contracts/` come from `/be-architect-specs <MODULE>` and are the artifact other services are
allowed to depend on -- never the prose.

A decision that binds only one service lives in that service's `adr/`. A decision that binds the
whole backend goes to `../adr/` instead.

## Services on record

| Module | Service | Backend language |
|---|---|---|
| `IMP` | `imp-service` | `node` |
| `COMP` | `comp-service` | `node` |
| `PUB` | `pub-service` | `node` |
| `PROJ` | `proj-service` | `node` |

## References

- [[../plans/README]] -- master plan and per-module plans
- [[../adr/README]] -- backend-wide decision records
- [[../README]] -- backend architecture entry point
