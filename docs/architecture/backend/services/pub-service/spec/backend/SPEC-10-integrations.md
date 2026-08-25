# SPEC-10 — Integrations

**Module:** PUB · **Refs:** `contracts/integration-contracts.md`, `contracts/hub-integration.md` (N/A),
`adr/ADR-001-service-boundary.md`, `adr/ADR-003-epubcheck-validation-port.md`.

## Objetivo

Especificar as integrações do PUB: portas in-process importadas (IMP/COMP/PROJ), portas exportadas
(PROJ), e os adapters de infraestrutura (epubcheck, storage).

## Escopo

- **In:** contratos de porta, direção, transporte e fallback (resumo em integration-contracts §4).
- **Out:** payloads REST (SPEC-01); montagem/veredito (SPEC-03).

## Decisões técnicas

**Importadas (out, in-process):**
- `ManuscriptContentPort.getContentTree(projetoId)` (IMP) — árvore read-only; `null` → `409
  manuscript-missing` no pré-flight.
- `GetMetadadosUseCase.get` + `GetConfiguracaoLayoutUseCase.get` (COMP) — metadados (obrigatórios:
  titulo/autor/idioma → senão `422`) e layout honrado/não-stale (senão defaults).
- `AdvanceProjetoStatusUseCase.advanceTo({projetoId, targetStatus})` (PROJ) — chamado 1x no desfecho
  (`publicado`/`com_erros`); PUB nunca chama `reopen` nem escreve `projeto_editorial` (D-C/D-P). Falha →
  desfecho preservado + `502 status-advance-failed`.

**Exportadas (in, in-process):**
- `PublicationHistoryPort` — `history`, `latest` (batched), `signedDownloadUrl`; field set fixo
  (api-contract §6.2), consumido por PROJ (D-E/D-F).
- `PublicationErasurePort.purge(projetoId)` — deleta linhas + artefatos; idempotente (LGPD step 1, D-G).

**Infra (out):**
- `EpubValidationPort` — epubcheck (child process JAR); veredito autoritativo.
- `FileStoragePort` — grava `.epub`, lê imagens do IMP, assina URL, deleta na erasure.

## Implementação

- Adapters em `src/infrastructure/{read,status,validation,storage,persistence}`; domínio depende só das
  portas (tokens DI). Nenhuma camada de domínio/aplicação nomeia IMP/COMP/PROJ/mammoth/epubcheck.
- Scaffold: se módulos irmãos ausentes, stubs finos (fixture tree; metadados mínimos; layout default;
  `advanceTo` echo) — ver integration-contracts §4 scaffold note.

## Casos de borda

- IMP/COMP indisponível no pré-flight → rejeição imediata (`409`/`422`), nenhum job.
- PROJ `advanceTo` ilegal/indisponível no desfecho → `Publicacao` persistida; reconciliação futura.
- epubcheck/storage indisponível → `com_erros` explícito; nunca publica não validado / sem artefato.

## Critérios de aceite (EARS)

- `THE SYSTEM SHALL read IMP/COMP only through in-process query ports at export time, never their tables.`
- `THE SYSTEM SHALL call PROJ.advanceTo exactly once per terminal outcome and never call reopen or write
  projeto_editorial.`
- `THE SYSTEM SHALL export PublicationHistoryPort and PublicationErasurePort with the fixed field set and
  idempotent purge for PROJ.`
- `THE SYSTEM SHALL reach epubcheck and the artifact only through EpubValidationPort and FileStoragePort.`
- `IF an outbound port fails, THEN THE SYSTEM SHALL degrade per integration-contracts §4 (reject pre-flight,
  or preserve outcome + 502, or record com_erros) — never publish an unvalidated or artifact-less success.`
