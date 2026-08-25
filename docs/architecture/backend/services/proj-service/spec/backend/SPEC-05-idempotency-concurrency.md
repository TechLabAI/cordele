# SPEC-05 — Idempotency & Concurrency

**Module:** PROJ · **Refs:** `contracts/api-contract.md` §7, `contracts/event-contracts.md` §3,
`contracts/integration-contracts.md` §1.3, §3, local `adr/ADR-002`. EARS per
`docs/architecture/backend/standards/ears-notation.md`.

## Objetivo

Definir idempotência de transições de status, idempotência da cascata de deleção, e concorrência de
chamadas in-process (IMP/PUB) sobre o mesmo projeto — dado que não há broker.

## Escopo

- **In:** idempotência de `advanceTo`/`reopen`; idempotência da cascata (`DELETE`); concorrência de
  transições/leituras; idempotência de eventos.
- **Out:** retries de broker (não há broker).

## Decisões técnicas

- **Transição idempotente na origem:** `advanceTo`/`reopen` só emitem `ProjectStatusChanged` e escrevem
  histórico quando o status muda de facto (SPEC-02). Retentativa in-process de IMP/PUB nunca duplica
  evento nem regride.
- **Cascata idempotente:** cada porta de erasure é no-op ao purgar dados já ausentes (SPEC-11), logo um
  `DELETE` reexecutado após falha parcial completa sem erro.
- **Concorrência:** a transição carrega/valida/escreve numa transação; `advanceTo` concorrentes no mesmo
  projeto serializam-se na linha; a leitura da versão pós-commit é sempre coerente. Sem lock de projeto
  para leituras (biblioteca/detalhe).
- **Evento:** `eventId` único; sob futuro broker, chave de idempotência at-least-once.

## Implementação

- `advanceTo` idempotência: `target==current` ou `target==em_composicao` com current pós-composição →
  no-op (SPEC-02 passos 3–4).
- Escrita de status + histórico + emissão de evento na **mesma transação**; evento despachado após commit.
- Duas transições concorrentes legais (ex.: PUB `publicado` e editor `reopen`) → serializadas; a segunda
  reavalia a tabela contra o status já commitado.

## Casos de borda

- PUB chama `advanceTo(publicado)` duas vezes (timeout de rede in-process) → 1ª aplica, 2ª no-op.
- IMP `confirm-estrutura` reenviado num projeto já `em_composicao`/`publicado` → no-op, sem regressão.
- `DELETE` reexecutado após purga parcial → completa (cada purge idempotente), depois remove a identidade.
- Dois `reopen` concorrentes → um aplica, o outro vira no-op.

## Critérios de aceite (EARS)

- `THE SYSTEM SHALL emit ProjectStatusChanged only when the status actually changes, so retried in-process
  calls never duplicate the event.`
- `WHEN advanceTo targets an already-reached status, THE SYSTEM SHALL return changed=false without side effects.`
- `THE SYSTEM SHALL apply a status change and its history row and event dispatch atomically per request.`
- `THE SYSTEM SHALL permit concurrent advanceTo calls on the same project by serializing them at the row,
  each re-evaluating the legal table against the committed status.`
- `WHEN a DELETE is retried after a partial cascade, THE SYSTEM SHALL complete idempotently (each purge a
  no-op on absent data) and then delete the identity row.`
- `THE SYSTEM SHALL assign every published event a unique eventId.`
