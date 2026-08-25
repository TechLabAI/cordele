# INT-COMP-003 -- GetMetadadosUseCase + GetConfiguracaoLayoutUseCase integration — PUB module wiring

**Status:** INTACT -- gerado 2026-08-25
**Maturidade:** 0 -- Inicial
**Done/Total:** 0/3 itens

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

- [ ] `src/modules/pub/pub.module.ts` (amend) — import `CompModule`; inject `GET_METADADOS_PORT` and `GET_CONFIGURACAO_LAYOUT_PORT` tokens into `EpubExportService` (or equivalent PUB use case)
- [ ] `test/comp-pub-integration.spec.ts` — integration test: seed project with composed metadata + layout + image override; call PUB export use case; verify metadata fields match api-contract §6.1; verify only non-stale overrides included; verify layout parameters limited to §7.3

## Criterios de aceite

- [ ] PUB export reads COMP's `GetMetadadosUseCase` without HTTP (in-process DI)
- [ ] Stale override excluded from layout returned to PUB (validated in integration test)
- [ ] Absent COMP metadata → PUB receives `null` and handles gracefully (does not crash)
- [ ] `pnpm test` on integration spec exits 0

## Dependencias

- COMP-016 (precede — export use cases and DI tokens must exist)
- PUB scaffold (precede — PubModule must exist to receive COMP injection)

## Estimativa
M

## Prioridade
P6
