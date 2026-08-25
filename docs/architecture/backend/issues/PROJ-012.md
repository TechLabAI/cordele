# PROJ-012 -- GetPublicationHistoryUseCase (GET /projetos/{id}/publicacoes via PublicationHistoryPort.history)

**Status:** INTACT -- gerado 2026-08-25
**Maturidade:** 0 -- Inicial
**Done/Total:** 0/4 itens

## Contexto

Implements `GET /api/proj/projetos/{projetoId}/publicacoes` (T08 "Histórico de exportações" list).
Calls `PublicationHistoryPort.history(projetoId)` (ADR-003 / D-E) to retrieve the full ordered
publication history from PUB's `Publicacao` records, newest first.

`arquivoUrl` in list items: the stub (PROJ-009) returns `null`; the real adapter (PROJ-INT-003)
may inline a signed URL or leave it `null` for non-downloadable statuses — the controller
documents the authoritative path as the download endpoint (§4.5).

## Spec de referencia
- SPEC-03 (read composition via port)
- api-contract.md §4.4, §6.3

## Escopo

Files to create (relative to monolith root `backend/`):

- [ ] `src/modules/proj/use-cases/get-publication-history.use-case.ts` — validates projetoId exists + belongs to active empresa (repository lookup); calls `PublicationHistoryPort.history(projetoId)`; enforces `arquivoUrl=null` for `erros_criticos|pendente` statuses; returns `PublicacaoHistoryItem[]` ordered by `criadoEm DESC`
- [ ] `src/modules/proj/use-cases/get-publication-history.use-case.spec.ts` — unknown projetoId → 404; known projetoId → full list returned; `erros_criticos` item has `arquivoUrl=null`
- [ ] `src/modules/proj/proj.controller.ts` — wire `GET /projetos/:projetoId/publicacoes` (update PROJ-001 stub); 200 with `PublicacaoHistoryItem[]`

## Criterios de aceite

- [ ] Returns `PublicacaoHistoryItem[]` ordered by `criadoEm DESC`
- [ ] Items with `epubcheckStatus in {erros_criticos, pendente}` have `arquivoUrl=null`
- [ ] Cross-tenant or non-existent projetoId returns 404
- [ ] `pnpm test` on use case spec exits 0

## Dependencias

- PROJ-008 (precede — ProjetoEditorialRepository for existence check)
- PROJ-009 (precede — PublicationHistoryPort stub)

## Estimativa
S

## Prioridade
P4
