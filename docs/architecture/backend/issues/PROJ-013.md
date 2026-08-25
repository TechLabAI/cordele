# PROJ-013 -- GetSignedDownloadUrlUseCase (GET /projetos/{id}/publicacoes/{pid}/download + 409 for non-downloadable)

**Status:** INTACT -- gerado 2026-08-25
**Maturidade:** 0 -- Inicial
**Done/Total:** 0/4 itens

## Contexto

Implements `GET /api/proj/projetos/{projetoId}/publicacoes/{publicacaoId}/download` (D-F). Mints
a short-TTL signed URL to the ePub artifact in object storage. PROJ **never streams bytes** — the
SPA opens the signed URL directly against object storage. PUB signs the artifact via its own
`FileStoragePort`; PROJ calls `PublicationHistoryPort.signedDownloadUrl(publicacaoId)`.

Only publications with `epubcheckStatus ∈ {valido, avisos}` have a downloadable artifact;
`erros_criticos` and `pendente` return 409 `urn:cordele:proj:artifact-not-available` (D-F).

## Spec de referencia
- api-contract.md §4.5, §6.3 (arquivoUrl null rule)
- integration-contracts.md §2.3 (signedDownloadUrl signature)

## Escopo

Files to create (relative to monolith root `backend/`):

- [ ] `src/modules/proj/use-cases/get-signed-download-url.use-case.ts` — validates `publicacaoId` belongs to `projetoId` and active empresa (via `PublicationHistoryPort.history(projetoId)` or a single-item fetch); checks `epubcheckStatus`; if `erros_criticos|pendente` throws `ArtifactNotAvailableError`; calls `PublicationHistoryPort.signedDownloadUrl(publicacaoId)`; returns `{ publicacaoId, arquivoUrl, expiresAt }`
- [ ] `src/domain/proj/errors/artifact-not-available.error.ts` — extends `DomainError`; carries `publicacaoId`, `epubcheckStatus`
- [ ] `src/modules/proj/use-cases/get-signed-download-url.use-case.spec.ts` — valid publication returns signed URL; `erros_criticos` returns `ArtifactNotAvailableError`; cross-tenant publicacaoId returns 404
- [ ] `src/modules/proj/proj.controller.ts` — wire `GET /projetos/:projetoId/publicacoes/:publicacaoId/download` (update PROJ-001 stub); map `ArtifactNotAvailableError` → 409 `urn:cordele:proj:artifact-not-available`

## Criterios de aceite

- [ ] Returns `{ publicacaoId, arquivoUrl, expiresAt }` for `valido|avisos` publications
- [ ] 409 `urn:cordele:proj:artifact-not-available` for `erros_criticos|pendente` publications
- [ ] 404 when `publicacaoId` does not belong to `projetoId` or active empresa
- [ ] PROJ never proxies bytes — the signed URL is opened by the SPA directly (no streaming in controller)
- [ ] `pnpm test` on use case spec exits 0

## Dependencias

- PROJ-009 (precede — PublicationHistoryPort stub with signedDownloadUrl)
- PROJ-011 (precede — projeto existence validated by same pattern)

## Estimativa
S

## Prioridade
P4
