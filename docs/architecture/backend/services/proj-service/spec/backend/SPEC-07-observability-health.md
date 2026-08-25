# SPEC-07 — Observability & Health

**Module:** PROJ · **Refs:** `contracts/api-contract.md` §3, `contracts/event-contracts.md`.
EARS per `docs/architecture/backend/standards/ears-notation.md`.

## Objetivo

Definir health checks, logging correlacionado, métricas e o sinal explícito de degradação de leitura
cross-context.

## Escopo

- **In:** liveness/readiness; `X-Correlation-Id`; logs de transição de status e de erasure; `degraded`.
- **Out:** dashboards/alerting (infra); tracing distribuído (não há mesh — monolito).

## Decisões técnicas

- **Health:** `GET /health/live` (processo) e `GET /health/ready` (DB alcançável). As portas de leitura
  cross-context **não** derrubam readiness — a sua indisponibilidade é degradação de resposta, não outage.
- **Correlação:** `X-Correlation-Id` propagado a logs e pipeline-events; gerado se ausente; devolvido
  sempre. As portas in-process herdam o correlationId via `EmpresaContext`.
- **Degradação explícita:** listagem/detalhe marcam `degraded=true` quando uma porta cross-context falha
  (nunca silenciam nem falham a resposta).

## Implementação

- Log estruturado por transição: `projetoId, statusDe, statusPara, solicitadoPor, correlationId`.
- Log por erasure: passos purgados (pub/comp/imp), sucesso/aborto, `projetoId`, `correlationId`.
- Métricas sugeridas: contagem de transições por par (de→para), no-ops idempotentes, erasures
  (sucesso/aborto), latência das portas de leitura, taxa de `degraded`.

## Casos de borda

- DB indisponível → readiness falha (503); liveness continua até o processo estar são.
- PUB/IMP/COMP indisponível → resposta `degraded=true`, readiness continua OK.

## Critérios de aceite (EARS)

- `THE SYSTEM SHALL expose liveness and readiness; readiness reflects DB reachability, not cross-context port health.`
- `THE SYSTEM SHALL echo X-Correlation-Id on every response and propagate it to logs and pipeline events.`
- `WHEN a status transition is applied, THE SYSTEM SHALL log statusDe, statusPara, solicitadoPor and correlationId.`
- `IF a cross-context read port is unavailable, THEN THE SYSTEM SHALL set degraded=true in the response and log it explicitly (never silent).`
- `WHEN an erasure runs, THE SYSTEM SHALL log each purge step and the final outcome (completed|aborted).`
