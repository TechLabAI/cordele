# INT-COMP-003 -- GetMetadadosUseCase + GetConfiguracaoLayoutUseCase integration — PUB module wiring

**Status:** DONE -- superada por INT-PUB-002 (2026-09-02)
**Maturidade:** 4 -- Completo
**Done/Total:** 3/3 itens (via caminho alternativo)

## Nota de reconciliacao (2026-09-02)

Esta issue foi especificada assumindo monolito (DI in-process, `PubModule` importando
`CompModule` diretamente, sem HTTP). A arquitetura real e de microsservicos separados
(`comp-service` e `pub-service` independentes), entao o escopo funcional equivalente foi
entregue por **INT-PUB-002** (DONE, 2026-09-02) via adapters HTTP:
`CompCompositionMetadataAdapter` e `CompCompositionLayoutAdapter`, com evidencia de
integracao real (`GET /api/v1/comp/projetos/{id}/metadados` e `/layout` respondendo
corretamente, contrato `MetadadosViewDto`/`LayoutViewDto` validado estaticamente contra
`CompMetadadosResponse`/`CompLayoutResponse`). Criterios de aceite abaixo cobertos por
esse caminho alternativo; escopo original (in-process) nao se aplica a topologia atual.

## Contexto

Wires PUB's injection of COMP's two export ports (`GET_METADADOS_PORT` and
`GET_CONFIGURACAO_LAYOUT_PORT`) into `PubModule` so that the ePub export pipeline can call
COMP's in-process use cases without HTTP. This is the real integration that replaces any
PUB-side stub of COMP data. Validates the end-to-end contract: PUB reads COMP data → receives
the correct field set (api-contract §6.1, §7.3) → generates ePub with correct metadata and
layout parameters. Stale override exclusion is already implemented in COMP-016; this issue
validates the integration from PUB's perspective.

## Spec de referencia
- `contracts/integration-contracts.md` §1.1–§1.2 (inbound ports for PUB)
- SPEC-10 (integrations — §1.1 GetMetadadosUseCase, §1.2 GetConfiguracaoLayoutUseCase)
- `contracts/api-contract.md` §7.3 (honoured parameter set for PUB)

## Escopo

Files to create / amend (relative to monolith root `backend/`):

- [x] Superado por `INT-PUB-002` — `CompCompositionMetadataAdapter`/`CompCompositionLayoutAdapter` (HTTP, nao DI in-process)
- [x] Superado por `INT-PUB-002` — cobertura de teste real (143/143) validando o contrato COMP↔PUB

## Criterios de aceite

- [x] PUB export le dados de COMP — via HTTP (`INT-PUB-002`), nao in-process DI (escopo original nao se aplica a topologia de microsservicos)
- [x] Stale override excluido do layout retornado a PUB (COMP-016, validado em `INT-PUB-002`)
- [x] Ausencia de metadados COMP → PUB trata com defaults do `EpubBuilder` sem crash
- [x] Gates de `INT-PUB-002` passando: test=PASS 143/143, lint=PASS, build=PASS, arch-conformance=OK 5/5

## Dependencias

- COMP-016 (precede — export use cases and DI tokens must exist)
- PUB scaffold (precede — PubModule must exist to receive COMP injection)

## Estimativa
M

## Prioridade
P6
