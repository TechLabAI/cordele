# SPEC-02 — Publication Build Orchestration (core)

**Module:** PUB · **Refs:** `contracts/api-contract.md` §7, `contracts/integration-contracts.md`,
`adr/ADR-002-async-build-status-machine.md`, `adr/ADR-003-epubcheck-validation-port.md`.

## Objetivo

Especificar o job assíncrono in-process que dirige a máquina de estados da `Publicacao`
(`gerando → validando → publicado | com_erros`): disparo, pré-flight, leitura in-process de IMP/COMP,
montagem, validação, persistência do desfecho, e a chamada `advanceTo` ao PROJ.

## Escopo

- **In:** orquestração ponta-a-ponta do build; transições de estado; pré-flight síncrono; chamada
  `advanceTo`; dispatch dos eventos.
- **Out:** detalhe de montagem OCF/OPF e mapeamento do veredito (SPEC-03); idempotência/concorrência
  (SPEC-05); persistência (SPEC-04).

## Decisões técnicas

- **Disparo (síncrono):** `GeneratePublicationUseCase.generate({ projetoId })` faz pré-flight
  (manuscrito presente via `ManuscriptContentPort`; metadados obrigatórios via `GetMetadadosUseCase`),
  cria a `Publicacao` em `gerando` com a próxima `sequencia`, enfileira o job in-process e retorna
  `publicacaoId` (`202`). D-R garante no máximo um build não-terminal por projeto.
- **Job (assíncrono, mesmo processo / `EmpresaContext` do request):** `PublicationBuildJob.run`:
  1. `gerando` → lê inputs (IMP `getContentTree`, COMP `getMetadados`/`getConfiguracaoLayout`) e monta o
     pacote ePub 3 (`EpubBuilder`).
  2. `validando` → `EpubValidationPort.validate` (epubcheck); persiste `validation_message`; mapeia o
     veredito para `status`/`epubcheckStatus` (D-Q).
  3. terminal → em `publicado` grava o `.epub` via `FileStoragePort` e seta `artefato_ref`; em `com_erros`
     grava `resumo_erro`. Persiste o desfecho.
  4. `AdvanceProjetoStatusUseCase.advanceTo({ projetoId, targetStatus })` (uma vez).
  5. dispatch `PublicationSucceeded` / `PublicationFailed` após commit (best-effort).

## Implementação

- A tabela de transições vive no VO `PublicationStatus` (nenhum controller/adapter re-codifica as regras).
- `advanceTo` é chamado **no máximo uma vez** por desfecho; falha nele não perde o resultado do build
  (SPEC-10 §fallback).
- O job não bloqueia a thread do request (montagem + epubcheck são longos — ADR-002); progresso é
  observado por polling (D-N).

## Casos de borda

- `advanceTo` lança (transição ilegal / PROJ indisponível) → `Publicacao` persistida; `502`
  `status-advance-failed` para observabilidade; reconciliável em export futuro.
- Falha de storage após build válido → desfecho `com_erros` com `resumo_erro` de storage
  (invariante `chk_publicacao_artefato`).
- Crash do processo durante o build → linha fica `gerando`/`validando`; re-disparo respeita o único
  em-voo (SPEC-05 trata reconciliação/timeout como assunção pós-POC, doc 06).

## Critérios de aceite (EARS)

- `WHEN an eligible export is triggered, THE SYSTEM SHALL create the Publicacao in gerando, enqueue the
  build job, and return 202 without blocking the request.`
- `WHEN the build finishes assembly, THE SYSTEM SHALL validate via EpubValidationPort and set
  status/epubcheckStatus from the verdict before persisting the terminal Publicacao.`
- `WHEN a terminal outcome is persisted, THE SYSTEM SHALL call advanceTo exactly once with publicado or
  com_erros.`
- `IF advanceTo fails, THEN THE SYSTEM SHALL keep the persisted Publicacao outcome and surface
  status-advance-failed.`
- `THE SYSTEM SHALL dispatch PublicationSucceeded/PublicationFailed only after commit (best-effort, not a
  status-change mechanism).`
