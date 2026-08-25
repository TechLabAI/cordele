# SPEC-05 — Idempotency & Concurrency

**Module:** PUB · **Refs:** `contracts/api-contract.md` §0 (D-R), `contracts/data-model.md` §2.1,
`adr/ADR-002-async-build-status-machine.md`.

## Objetivo

Definir a idempotência do disparo de exportação e a concorrência de builds, dado que o build é assíncrono
in-process e a história é append-only.

## Escopo

- **In:** único build não-terminal por projeto; disparo idempotente; alocação de `sequencia`; concorrência
  de disparos paralelos.
- **Out:** retries de broker (não há broker); dedupe por content-hash (não aplicável — cada export é um
  novo artefato por design).

## Decisões técnicas

- **Único em-voo (D-R):** no máximo uma `Publicacao` em `gerando`/`validando` por projeto, garantido pelo
  índice parcial único `uq_publicacao_projeto_inflight`.
- **Disparo idempotente:** re-disparar com build em voo retorna o `publicacaoId` existente (`200`), sem
  iniciar segundo job. Não há `Idempotency-Key`; a identidade é o par (projeto, build em voo).
- **`sequencia`:** monotônica por projeto; próximo valor = `max(sequencia)+1` dentro do tenant, protegido
  por `uq_publicacao_projeto_seq` + retry em colisão.

## Implementação

- `GeneratePublicationUseCase`: dentro do `EmpresaContext`, consulta build em voo; se existir, retorna-o;
  senão insere nova `Publicacao` (o índice parcial serializa corridas — a 2ª inserção falha e relê o
  em-voo).
- Build assíncrono ⇒ sem estado intermediário compartilhado entre requests além da própria linha
  `publicacao` (a máquina de estados é persistida a cada transição).

## Casos de borda

- Dois disparos simultâneos no mesmo projeto → um cria, o outro recebe violação do índice parcial e retorna
  o em-voo (ambos `200`/`202` coerentes; um único job).
- Re-disparo após término → nova `Publicacao` `sequencia+1` (re-export, D-P), não bloqueado.
- Build órfão (crash deixou `gerando`/`validando`) → o índice parcial impede novo disparo; a reconciliação
  (timeout → `com_erros`) é assunção pós-POC (doc 06), fora do MVP.

## Critérios de aceite (EARS)

- `IF an export is triggered while a build for the project is in gerando or validando, THEN THE SYSTEM
  SHALL return the in-flight publicacao (200) and start no second job.`
- `THE SYSTEM SHALL permit at most one non-terminal publicacao per project (partial unique index).`
- `WHEN an export is triggered after a terminal build, THE SYSTEM SHALL create a new publicacao with the
  next sequencia.`
- `THE SYSTEM SHALL assign a unique, monotonic sequencia per project even under concurrent triggers.`
