# COMP-005 -- UploadCoverUseCase + RemoveCoverUseCase + FileStoragePort interface

**Status:** INTACT -- gerado 2026-08-25
**Maturidade:** 0 -- Inicial
**Done/Total:** 0/5 itens

## Contexto

Implements cover upload and removal through `FileStoragePort`. The cover binary is never stored
in the DB — only `capaUrl` reference is persisted (ADR-003 / D-L). Validation of media type
(`image/jpeg|png|webp`) and size (`≤ 10 MB`) happens in the **use case** before any storage call
(defense-in-depth: not only at controller level). Upload materializes `Metadados` if absent.
Removal of a cover that does not exist is idempotent (204, no error). Both operations emit
`MetadataUpdated` post-commit. `FileStoragePort` interface is declared here; the disk POC
adapter is in COMP-015; the S3 adapter in INT-COMP-002.

## Spec de referencia
- SPEC-02 (cover upload/remove — validation, optional, 413/415, idempotent remove, FileStoragePort)
- SPEC-10 (integrations — FileStoragePort signatures: put/delete)
- `contracts/data-model.md` §2.1 (capa_url reference; never bytes in row)
- `contracts/integration-contracts.md` §2.2 (FileStoragePort contract)

## Escopo

Files to create (relative to monolith root `backend/`):

- [ ] `src/infrastructure/comp/storage/file-storage.port.ts` — interface `FileStoragePort` with `put(key: string, stream: Readable, contentType: string): Promise<{ url: string }>` and `delete(url: string): Promise<void>`
- [ ] `src/modules/comp/application/upload-cover.use-case.ts` — `execute({ projetoId, file: { buffer, mimetype, size } })`: validate `mimetype ∈ {image/jpeg,image/png,image/webp}` (415 if not) and `size ≤ COMP_COVER_MAX_BYTES` (413 if not); `FileStoragePort.put`; set `capaUrl`; materialize `Metadados` if absent; persist; emit `MetadataUpdated`; respond 201
- [ ] `src/modules/comp/application/remove-cover.use-case.ts` — `execute({ projetoId })`: load `Metadados`; if `capaUrl` is null, return (idempotent); else `FileStoragePort.delete(capaUrl)`; clear `capaUrl`; persist; emit `MetadataUpdated`; respond 204
- [ ] `src/modules/comp/application/upload-cover.use-case.spec.ts` — happy path 201; > 10 MB → 413; unsupported type → 415; absent Metadados → materializes first
- [ ] `src/modules/comp/application/remove-cover.use-case.spec.ts` — remove existing cover (204); remove when capaUrl=null (no-op 204)

## Criterios de aceite

- [ ] Upload of `image/gif` responds 415 and stores nothing
- [ ] Upload of file > 10 MB (`COMP_COVER_MAX_BYTES`) responds 413 and stores nothing
- [ ] Remove cover when `capaUrl=null` responds 204 without calling `FileStoragePort.delete`
- [ ] `MetadataUpdated` emitted on both successful upload and successful remove
- [ ] `pnpm test` on both use case specs exits 0

## Dependencias

- COMP-003 (precede — Metadados aggregate)
- COMP-004 (precede — MetadadosRepository port interface declared)
- COMP-001 (precede — DI tokens for upload/remove declared)

## Estimativa
M

## Prioridade
P2
