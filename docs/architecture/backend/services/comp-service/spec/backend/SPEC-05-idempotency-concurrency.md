# SPEC-05 — Idempotency & Concurrency

**Module:** COMP · **Refs:** `contracts/api-contract.md` §1, §4.2, §4.6, `contracts/event-contracts.md` §3,
`contracts/data-model.md` §1. EARS per `docs/architecture/backend/standards/ears-notation.md`.

## Objetivo

Definir a idempotência dos upserts de metadados/layout, a materialização lazy de defaults, a idempotência
da porta de erasure, e a concorrência de escritas sobre o mesmo projeto — sem broker.

## Escopo

- **In:** idempotência de `PUT metadados`/`PUT layout` (upsert por `projetoId`); materialização lazy (D-M);
  idempotência de `CompositionErasurePort.purge`; concorrência de escritas COMP; idempotência de eventos.
- **Out:** retries de broker (não há broker); status transitions (PROJ).

## Decisões técnicas

- **Upsert idempotente por `projetoId`:** `UNIQUE(projeto_id)` + upsert; reenvio de corpo idêntico é no-op
  que devolve a representação atual. Sem duplicação de linha, sem histórico de versão no POC.
- **Defaults lazy (D-M):** `GET` de agregado ausente devolve default (`materialized=false`), sem gravar; a
  linha materializa no 1º `PUT`. COMP não consome `ManuscriptImported` (sem criação eager).
- **Layout como snapshot de overrides:** `PUT layout` substitui o conjunto de overrides do projeto de forma
  atômica (delete+insert ou upsert-diff na mesma transação) — o corpo é a verdade completa do layout.
- **Erasure idempotente:** `purge(projetoId)` é no-op ao apagar dados já ausentes (SPEC-10).
- **Concorrência:** escrita carrega/valida/persiste numa transação; escritas concorrentes no mesmo projeto
  serializam-se na linha (`UNIQUE`); a leitura pós-commit é coerente. Sem lock para leituras (preview/detalhe).

## Implementação

- `upsert` metadata/layout: carrega por `projeto_id`; se ausente cria; aplica; persiste; emite evento pós-commit.
- `PUT layout` overrides: valida todos (nodeExists) **antes** de persistir; troca o conjunto atomicamente.
- Evento carrega `eventId` único + `atualizadoEm` para dedup futura (broker post-POC).

## Casos de borda

- `PUT` idêntico reenviado (timeout de rede) → 1ª aplica, 2ª no-op; representação idêntica.
- `GET` antes de qualquer `PUT` → default `materialized=false`, nada gravado.
- Dois `PUT layout` concorrentes → serializam; o 2º revalida `nodeExists` contra a árvore atual.
- `purge` reexecutado após falha parcial → completa (no-op nos já ausentes).

## Critérios de aceite (EARS)

- `THE SYSTEM SHALL treat re-sending an identical metadata or layout body as an idempotent no-op returning the current representation.`
- `WHEN a GET targets an aggregate not yet materialized, THE SYSTEM SHALL return a default representation without persisting anything.`
- `THE SYSTEM SHALL materialize the aggregate row only on the first PUT (lazy defaults, D-M).`
- `THE SYSTEM SHALL apply a layout upsert and its full override set atomically per request.`
- `THE SYSTEM SHALL permit concurrent writes on the same project by serializing at the projeto_id row.`
- `WHEN purge is retried after a partial erasure, THE SYSTEM SHALL complete idempotently (no-op on absent data).`
- `THE SYSTEM SHALL assign every published event a unique eventId.`
