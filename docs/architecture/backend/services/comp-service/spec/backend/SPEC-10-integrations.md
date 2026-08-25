# SPEC-10 — Integrations

**Module:** COMP · **Refs:** `contracts/integration-contracts.md`, `contracts/api-contract.md` §6.5,
shared `adr/ADR-001-hexagonal-node.md`, local `adr/ADR-002`, `adr/ADR-003`. EARS per
`docs/architecture/backend/standards/ears-notation.md`.

## Objetivo

Definir as integrações in-process de COMP: as portas inbound que COMP exporta (PUB, PROJ) e as portas
outbound que COMP importa (IMP read-only, FileStorage). Não há API de terceiros, broker ou AI.

## Escopo

- **In:** `GetMetadadosUseCase`/`GetConfiguracaoLayoutUseCase` (PUB, export); `ProjectMetadataPort` (PROJ,
  library); `CompositionErasurePort` (PROJ, LGPD cascade); `ManuscriptContentPort` (IMP, read-only);
  `FileStoragePort` (capa).
- **Out:** status (PROJ port-driven); build/epubcheck (PUB); parsing (IMP).

## Decisões técnicas

- **COMP↔PUB (D-I/G2):** PUB lê composição por porta in-process, nunca das tabelas. `GetMetadados` devolve
  o field set fixo (§6.1); `GetConfiguracaoLayout` devolve layout + **apenas overrides não-stale honrados**
  (§7.3). Parâmetros honrados fixos (api-contract §7.3) — o painel T06 expõe só esses.
- **COMP↔PROJ:** `ProjectMetadataPort.metadata(projetoIds)` batched (sem N+1) para T02/T08;
  `CompositionErasurePort.purge(projetoId)` idempotente (linhas + binário da capa), passo 2 da cascata (G3/D-G).
- **COMP↔IMP (D-K/ADR-002):** `ManuscriptContentPort` read-only (`getContentTree`, `nodeExists`); COMP nunca
  escreve dados do IMP.
- **Storage (ADR-003/D-L):** `FileStoragePort` (`put`/`delete`) disk (POC)/S3 (prod), selecionado por config.

## Implementação

- Portas exportadas registradas por Symbol token no `CompModule.providers`; PUB/PROJ injetam por token.
- Adapters de infraestrutura implementam `ManuscriptContentPort` (chama a query port in-process do IMP) e
  `FileStoragePort` (disk/S3).
- Erasure: `purge` apaga `metadados`/`configuracao_layout` (overrides via FK cascade) + `FileStoragePort.delete(capaUrl)`.

## Casos de borda

- PUB chama `GetConfiguracaoLayout` com overrides pendentes (ref removida por re-import) → devolve só os não-stale.
- `GetMetadados`/`GetConfiguracaoLayout` sem composição → `null` (PUB decide; export exige mínimos, R4).
- `purge` num projeto já purgado → no-op idempotente.
- IMP ausente no scaffold → stub read-only (fixture) até a implementação real.

## Critérios de aceite (EARS)

- `WHEN PUB reads composition at export, THE SYSTEM SHALL return persisted Metadados and ConfiguracaoLayout through the in-process ports, never exposing COMP tables.`
- `WHEN GetConfiguracaoLayout is called, THE SYSTEM SHALL return only non-stale image-alignment overrides and the honoured parameter set (§7.3).`
- `WHEN PROJ requests library metadata, THE SYSTEM SHALL return author per project batched by projetoId set.`
- `WHEN PROJ purges a project, THE SYSTEM SHALL idempotently delete COMP rows and the cover binary.`
- `THE SYSTEM SHALL read the manuscript only through ManuscriptContentPort (read-only) and never mutate IMP data.`
- `THE SYSTEM SHALL store the cover binary only through FileStoragePort, keeping capaUrl as the sole reference.`
