# INT-PUB-004 -- PublicationHistoryPort: registro DI em ProjModule para consumo by PROJ

**Status:** REDUCED -- pos-validacao 2026-09-03
**Maturidade:** 10 -- Inicial
**Done/Total:** 2/6 itens

## Contexto

Registrar o `PublicationHistoryPort` (PUB-014) como provider injetável no `ProjModule`, permitindo
que `PROJ` consuma `history`, `latest` e `signedDownloadUrl` sem importar classes internas de PUB.
O `PubModule` exporta o token; o `ProjModule` importa o `PubModule` e injeta o token. Alinha com
integration-contracts §1.1 e proj api-contract §4.4 / §6.3 / §6.4.

## Spec de referencia
- `contracts/integration-contracts.md` (§1.1 — PublicationHistoryPort)
- `contracts/api-contract.md` §6.4 (inbound ports exported by PUB)

## Escopo

Files to create (relative to monolith root `backend/`):

- [x] `src/modules/proj/proj.module.ts` (proj-service) — `PUBLICATION_HISTORY_PORT` fornecido globalmente via `ReadPortsModule (@Global())` importado em `AppModule`; `ProjModule` não importa `PubModule` diretamente (padrão HTTP adapter correto para microserviços); verificado P12
- [x] `src/modules/proj/use-cases/get-projeto-detail.use-case.ts` — (nome real difere); injeta `PUBLICATION_HISTORY_PORT` via DI global; delega ao adapter HTTP; verificado P12
- [x] `src/infrastructure/proj/read/publication-history.adapter.spec.ts` — (path real difere: `infrastructure/proj/read/` em vez de `modules/proj/integration/`); spec do adapter HTTP; verificado P12

## Criterios de aceite
- [x] `pnpm build` exits 0 — confirmado em BASELINE 2026-09-03 (proj-service)
- [x] `pnpm test src/infrastructure/proj/read/publication-history.adapter.spec.ts` exits 0 (passes no path real)
- [x] Nenhum import direto de `PublicacaoRepository` ou `PublicationHistoryService` em PROJ — verificado: padrão HTTP adapter, sem import cruzado

## Dependencias
- PUB-014 (PublicationHistoryPort implementado + token exportado)
- PROJ: ProjModule existente

## Estimativa
S

## Prioridade
P6
