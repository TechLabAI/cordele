# SPEC-11 — Publication KPIs (read model)

**Module:** PUB · **Refs:** `contracts/api-contract.md` §4.5/§6.3 (D-O), `contracts/data-model.md` §2,
`contracts/integration-contracts.md` §1.1.

## Objetivo

Especificar a projeção de KPIs que alimenta os cards das telas T07/T08, computada **ao vivo** sobre as
linhas de `Publicacao`/`validation_message` — sem store de analytics separado (D-O).

## Escopo

- **In:** `GetPublicationStatsUseCase` e o endpoint `GET .../publicacoes/stats`; agregações e semântica dos
  campos; fonte única de verdade.
- **Out:** dashboards; métricas operacionais (SPEC-07); histórico item-a-item (SPEC-01 §4.3).

## Decisões técnicas

- **Fonte (D-O):** os KPIs são uma projeção viva de `Publicacao` (+ severidades em `validation_message`),
  escopada à empresa ativa. Não há pipeline/warehouse/event-store (`analytics`/`elastic` off, `ai.hasAi`
  false). É a mesma tabela que dirige o histórico (T08) — nunca uma segunda fonte que possa divergir.
- **Campos (`PublicationStats`, api-contract §6.3):** `total`, `publicadas` (`status=publicado`),
  `comAvisos` (subset `epubcheckStatus=avisos`), `comErros` (`status=com_erros`), `emAndamento`
  (não-terminal), `ultimoStatus`/`ultimoEpubcheckStatus`/`ultimaPublicacaoEm` (mais recente).

## Implementação

- `GetPublicationStatsUseCase` agrega por `projetoId` via Prisma (`groupBy status`/`epubcheck_status`,
  `max(iniciada_em)`); custo O(nº de publicações do projeto), aceitável no POC.
- Reusa `PublicationHistoryPort.latest` para o "último" quando conveniente (mesma projeção).

## Casos de borda

- Projeto sem publicações → todos os contadores 0; `ultimo*` = null.
- Build em voo conta em `emAndamento`, não em `publicadas`/`comErros`.
- `avisos` conta como `publicadas` **e** `comAvisos` (é sucesso publicado, D-Q) — o FE renderiza como
  sucesso com ressalva, não falha.

## Critérios de aceite (EARS)

- `WHEN stats are requested for a project of the active empresa, THE SYSTEM SHALL return total, publicadas,
  comAvisos, comErros, emAndamento and the latest outcome computed live from its publicacao rows.`
- `THE SYSTEM SHALL compute KPIs only from PUB's own rows scoped to the active empresa, never from a
  separate analytics source.`
- `THE SYSTEM SHALL count avisos publications as publicadas (a published outcome), not as failures.`
- `WHERE a project has no publications, THE SYSTEM SHALL return zeroed counters and null latest fields.`
