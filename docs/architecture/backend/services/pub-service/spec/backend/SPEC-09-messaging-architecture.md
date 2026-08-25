# SPEC-09 — Messaging Architecture

**Module:** PUB · **Refs:** `contracts/event-contracts.md`, `contracts/api-contract.md` §0 (D-N),
`adr/ADR-002-async-build-status-machine.md`.

## Objetivo

Especificar o modelo de mensageria/sinais do PUB: eventos in-process best-effort e a ausência deliberada de
broker/push — que fundamenta o progresso por polling (D-N).

## Escopo

- **In:** eventos publicados in-process (`PublicationSucceeded`/`PublicationFailed`); racional do polling
  vs SSE vs long-request; propagação de contexto.
- **Out:** contratos de payload detalhados (event-contracts.md); consumo (não há — SPEC-10).

## Decisões técnicas

- **Sem broker** (`messaging.enabled=false`): sinalização cross-context é in-process (NestJS event emitter),
  best-effort, após commit. Não é entrega garantida cross-process.
- **Progresso por polling (D-N):** sem canal de push, o cliente faz poll de `GET .../status` com
  `Retry-After`. **SSE rejeitado** no POC (conexão mantida + ciclo de vida não se justificam para o BFF
  único); **long-request rejeitado** (montagem+epubcheck longos não podem bloquear a thread).
- **Eventos ≠ mudança de status:** os eventos apenas notificam refresh de read-model/UI; a mudança de
  status do projeto é a chamada síncrona `advanceTo` (D-P).

## Implementação

- Dispatch após commit da linha terminal e do `advanceTo`; `eventId` único por evento.
- Propagação de contexto (`correlationId`, `empresa`, `principalId`) via `EmpresaContext`, não no payload.

## Casos de borda

- Consumidor lança durante o dispatch → não afeta o desfecho persistido (best-effort).
- Post-POC com broker → build vira command message + status pushed; nomes/payloads de evento permanecem
  compatíveis (mudança de adapter/transport, não de domínio).

## Critérios de aceite (EARS)

- `THE SYSTEM SHALL dispatch PublicationSucceeded/PublicationFailed in-process after commit, best-effort,
  assigning each a unique eventId.`
- `THE SYSTEM SHALL expose build progress by polling with a Retry-After hint, not by SSE or a long
  synchronous request (D-N).`
- `THE SYSTEM SHALL NOT treat domain events as the project-status-change mechanism (that is advanceTo).`
- `WHERE a broker is enabled post-POC, THE SYSTEM SHALL keep event names and payloads compatible.`
