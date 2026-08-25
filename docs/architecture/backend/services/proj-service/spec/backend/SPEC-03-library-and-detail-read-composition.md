# SPEC-03 — Library & Detail Read Composition (T02 / T08)

**Module:** PROJ · **Refs:** `contracts/api-contract.md` §4.2–4.4, §6.2–6.4,
`contracts/integration-contracts.md` §2, ADR-003. EARS per `docs/architecture/backend/standards/ears-notation.md`.

## Objetivo

Especificar como PROJ compõe as telas de leitura de referência — **T02 biblioteca-de-projetos** e
**T08 download-e-historico** — a partir da sua identidade/status próprios + leituras cross-context (IMP,
COMP, PUB) atrás de portas, sem N+1 e degradando quando uma porta cai.

## Escopo

- **In:** `ListProjectsUseCase` (T02), `GetProjectDetailUseCase` (cabeçalho T08 + detalhe),
  `GetPublicationHistoryUseCase` (lista T08); composição batched; regra do badge de status.
- **Out:** minting de URL assinada (SPEC-06/§4.5), autoria/persistência dos dados lidos (IMP/COMP/PUB).

## Decisões técnicas

- **Sem N+1:** as portas de leitura são chamadas **uma vez com o conjunto de projetoIds** da página
  (`ManuscriptSummaryPort.summaries`, `PublicationHistoryPort.latest`, `ProjectMetadataPort.metadata`),
  não uma vez por card (api-contract §6.4).
- **Badge de status (T02):** `rascunho`/`em_composicao` → mostra o status do projeto; havendo publicação,
  o badge reflete `ultimoEpubcheckStatus` (`valido|avisos|erros_criticos`) — casa com a legenda do
  protótipo ("Válido · N avisos · N erros · Rascunho").
- **Degradação (ADR-003):** porta cross-context indisponível → campo nulo + `degraded=true`; o status
  próprio do projeto sempre renderiza.

## Implementação

`ProjetoCard` (T02): `id, nome, autor(COMP), status, totalCapitulos/totalImagens(IMP último manuscrito),
ultimoEpubcheckStatus(PUB última publicação), ultimaAtividadeEm, criadoEm`.

`ProjetoDetail` (T08 cabeçalho): identidade + status + `manuscriptSummary(IMP)` + `metadata.autor(COMP)` +
`publicationHistory(PUB)`.

Lista T08 (`GET .../publicacoes`): `PublicacaoHistoryItem[]` via `PublicationHistoryPort.history`,
ordenada por `criadoEm desc`, com `epubcheckStatus, totalErros, totalAvisos, erros, arquivoUrl`.

`ultimaAtividadeEm` = max(`projeto_editorial.atualizado_em`, última `Publicacao.criadoEm`).

## Casos de borda

- Projeto sem manuscrito (rascunho) → counts=0, `manuscriptSummary=null`, badge `rascunho`.
- Projeto sem metadados (COMP ainda não compôs) → `autor=null` (protótipo "Contos Urbanos / em andamento").
- Projeto nunca exportado → `ultimoEpubcheckStatus=null`, `publicationHistory=[]`.
- PUB fora do ar → `history=[]`/badge nulo, `degraded=true`, status próprio renderiza.

## Critérios de aceite (EARS)

- `WHEN the editor lists projects, THE SYSTEM SHALL return ProjetoCard[] ordered by ultimaAtividadeEm desc,
  each with counts (IMP), last epubcheck (PUB) and author (COMP).`
- `THE SYSTEM SHALL resolve library cross-context fields with a bounded number of port calls independent of
  the number of projects (batched by projetoId set).`
- `WHERE a project has no manuscript, THE SYSTEM SHALL return totalCapitulos=0 and totalImagens=0.`
- `WHEN project detail is requested, THE SYSTEM SHALL compose status + manuscriptSummary + metadata +
  publicationHistory.`
- `IF a cross-context read port is unavailable, THEN THE SYSTEM SHALL return the project's own status with
  the degraded fields null and degraded=true, never failing the read.`
- `THE SYSTEM SHALL return publication history ordered by criadoEm descending.`
