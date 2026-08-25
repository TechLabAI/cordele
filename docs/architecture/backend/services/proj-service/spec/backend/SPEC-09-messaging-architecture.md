# SPEC-09 — Messaging Architecture

**Module:** PROJ · **Refs:** `contracts/event-contracts.md`, doc 04, local `adr/ADR-002`.
EARS per `docs/architecture/backend/standards/ears-notation.md`.

## Objetivo

Fixar que PROJ usa **eventos in-process** (NestJS event emitter), sem broker (`messaging.enabled=false`),
e que o status **não** é dirigido por eventos.

## Escopo

- **In:** emissão in-process de `ProjectCreated`/`ProjectStatusChanged`/`ProjectDeleted`; ausência de
  consumo; caminho async futuro atrás das mesmas portas.
- **Out:** qualquer broker/topic/queue (não existe no POC).

## Decisões técnicas

- **Sem broker:** eventos são notificações best-effort, mesmo processo, **após commit**; não são garantia
  de entrega nem o mecanismo que dirige status (ADR-002).
- **PROJ não consome eventos** para mudar status: só as portas `advanceTo`/`reopen` (síncronas) o fazem.
  Isto supersede a anotação em `imp-service` que rotulava PROJ como consumidor de `ManuscriptImported`.
- **Caminho async futuro:** se um broker for ligado, `advanceTo` pode ser frontado por comando e o
  histórico materializado de eventos PUB, atrás das mesmas portas — sem mudança de domínio.

## Implementação

Eventos, canais e payloads: `contracts/event-contracts.md`. Despacho após commit via post-commit hook.

## Casos de borda

- Rollback da transação → nenhum evento publicado.
- No-op idempotente → nenhum `ProjectStatusChanged`.
- Listener in-process a lançar erro → não afeta a transação já commitada (best-effort).

## Critérios de aceite (EARS)

- `THE SYSTEM SHALL dispatch domain events in-process after commit, with no broker.`
- `THE SYSTEM SHALL NOT change status in response to any consumed event.`
- `IF the transaction rolls back, THEN THE SYSTEM SHALL publish no event.`
- `WHERE a broker is later enabled, THE SYSTEM SHALL keep event names and payloads compatible and status
  port-driven.`
