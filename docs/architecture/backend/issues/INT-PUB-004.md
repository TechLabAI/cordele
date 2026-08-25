# INT-PUB-004 -- PublicationHistoryPort: registro DI em ProjModule para consumo by PROJ

**Status:** INTACT -- gerado 2026-08-25
**Maturidade:** 0 -- Inicial
**Done/Total:** 0/3 itens

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

- [ ] `src/modules/proj/proj.module.ts` — acrescentar `PubModule` nos `imports`; injetar `PUBLICATION_HISTORY_PORT` token nos consumers (use cases de detail/library/download de PROJ)
- [ ] `src/modules/proj/application/get-project-detail.use-case.ts` — (se existir) substituir acesso direto à tabela `publicacao` pelo `PublicationHistoryPort.latest` injetado; degradar para `publicacoes=[]` se porta indisponível (integration-contracts §1.1 fallback)
- [ ] `src/modules/proj/integration/pub-history.adapter.spec.ts` — smoke test: `ProjModule` inicializa com `PubModule` sem erro de DI; `PUBLICATION_HISTORY_PORT` resolvível; `history` retorna array

## Criterios de aceite
- [ ] `pnpm build` exits 0 com `ProjModule` importando `PubModule`
- [ ] `pnpm test src/modules/proj/integration/pub-history.adapter.spec.ts` exits 0
- [ ] Nenhum import direto de `PublicacaoRepository` ou `PublicationHistoryService` em arquivos de PROJ

## Dependencias
- PUB-014 (PublicationHistoryPort implementado + token exportado)
- PROJ: ProjModule existente

## Estimativa
S

## Prioridade
P6
