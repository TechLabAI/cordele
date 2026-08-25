# SPEC-09 — Messaging Architecture

**Module:** COMP · **Refs:** `contracts/event-contracts.md`, `events/event-catalog.md`, doc 04
*Async vs Sync*. EARS per `docs/architecture/backend/standards/ears-notation.md`.

## Objetivo

Definir a arquitetura de mensageria de COMP: **in-process apenas** (`messaging.enabled = false`), sem
broker. Eventos são notificações best-effort pós-commit; não drivam status.

## Escopo

- **In:** eventos publicados `MetadataUpdated` / `LayoutUpdated` (realizam o anchor `CompositionUpdated`);
  ausência de consumo de eventos; timing pós-commit; caminho async futuro.
- **Out:** broker/Kafka (desabilitado); status transitions (PROJ, port-driven); entrega cross-process.

## Decisões técnicas

- **Sem broker:** NestJS event emitter in-process; cada evento dispara uma vez, pós-commit, na mesma request.
- **Anchor realizado (M1.5):** `CompositionUpdated` não vai no fio; concretiza-se como `MetadataUpdated`
  (upsert de metadados/capa) e `LayoutUpdated` (upsert de layout/overrides).
- **Não consome eventos:** defaults são lazy (D-M); a leitura do manuscrito é port call read-only, não
  subscription. COMP nunca muda `projeto_editorial.status` por evento (ADR-002 boundary).
- **Idempotência de evento:** `eventId` único; sob broker futuro, chave de dedup at-least-once.

## Implementação

- `emit` pós-commit (hook de transação); rollback ⇒ sem emissão.
- `MetadataUpdated { projetoId, hasCover, atualizadoEm }`; `LayoutUpdated { projetoId, totalOverrides, atualizadoEm }`.
- Consumidores (POC): refresh de preview/UI, hint de read-model de autor no PROJ — nenhum obrigatório.

## Casos de borda

- Transação de upsert faz rollback → nenhum evento.
- Reenvio idempotente de upsert → política de re-emissão deixada ao scaffold; `atualizadoEm` permite dedup.
- Ninguém consome os eventos no POC → sem efeito colateral (best-effort).

## Critérios de aceite (EARS)

- `THE SYSTEM SHALL dispatch MetadataUpdated and LayoutUpdated in-process after commit, never through a broker.`
- `IF a transaction rolls back, THEN THE SYSTEM SHALL NOT publish its event.`
- `THE SYSTEM SHALL NOT consume any event; defaults are materialized lazily and status is never event-driven.`
- `THE SYSTEM SHALL assign every event a unique eventId for future at-least-once dedup.`
