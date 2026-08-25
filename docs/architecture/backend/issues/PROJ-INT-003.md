# PROJ-INT-003 -- PublicationHistoryPort real adapter binding to PUB query port (history + latest + signedDownloadUrl)

**Status:** INTACT -- gerado 2026-08-25
**Maturidade:** 0 -- Inicial
**Done/Total:** 0/5 itens

## Contexto

Replaces the `PublicationHistoryPort` stub (PROJ-009) with a real adapter calling PUB's in-process
query ports. This is the most complex of the three read adapters because it exposes three methods:

1. `history(projetoId)` — full publication history for T08 list
2. `latest(projetoIds)` — latest publication per project for T02 library card (batched)
3. `signedDownloadUrl(publicacaoId)` — delegates to PUB's `FileStoragePort.signedUrl` (D-F)

PUB signs the URL via its own `FileStoragePort` — PROJ never owns storage access. For
`erros_criticos|pendente` publications, `arquivoUrl=null` is returned by the port (not an error);
the use case (PROJ-013) enforces the 409 when `signedDownloadUrl` is called for a non-downloadable.

## Spec de referencia
- integration-contracts.md §2.3 (PublicationHistoryPort full signature + field set)
- api-contract.md §4.5, §6.3 (D-E, D-F)
- ADR-003-publication-history-read-model.md (local)

## Escopo

Files to create (relative to monolith root `backend/`):

- [ ] `src/infrastructure/proj/read/publication-history.adapter.ts` — implements `PublicationHistoryPort`; `history(projetoId)`: calls PUB's in-process `PublicacaoQueryPort.historyByProjeto(projetoId)`, maps to `PublicacaoHistoryItem[]`; `latest(projetoIds)`: calls PUB's `PublicacaoQueryPort.latestByProjetoIds(projetoIds)` in one batched call; `signedDownloadUrl(publicacaoId)`: delegates to PUB's `FileStoragePort.signedUrl(publicacaoId, ttlSeconds)`, wraps in `{ arquivoUrl, expiresAt }`; on PUB unavailability: `history()` returns `[]`, `latest()` returns empty Map, `signedDownloadUrl()` rethrows (caller handles as 502)
- [ ] `src/infrastructure/proj/read/publication-history.adapter.spec.ts` — `history()` maps correctly; `latest()` makes 1 call; `signedDownloadUrl()` delegates to PUB's storage port; PUB unavailable → `history()` returns `[]`
- [ ] `src/modules/proj/proj.module.ts` — env-flag switch to register real adapter under `PUBLICATION_HISTORY_PORT`

## Criterios de aceite

- [ ] `latest(projetoIds)` makes exactly 1 call to PUB's query port (batching invariant)
- [ ] `signedDownloadUrl(publicacaoId)` returns `{ arquivoUrl: string, expiresAt: string }` from PUB's signed URL — PROJ never calls storage directly
- [ ] PUB unavailability: `history()` returns `[]`, `latest()` returns empty Map (callers degrade gracefully)
- [ ] `signedDownloadUrl` for a non-downloadable publication: the port itself does not 409; the use case (PROJ-013) enforces the 409 based on `epubcheckStatus`
- [ ] `pnpm test` on adapter spec exits 0

## Dependencias

- PROJ-009 (precede — port interface and stub must exist)
- PROJ-013 (precede — signedDownloadUrl use case enforces 409 logic)
- PUB exported publication query port + FileStoragePort (PUB scaffolded)

## Estimativa
M

## Prioridade
P4
