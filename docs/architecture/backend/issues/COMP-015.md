# COMP-015 -- FileStoragePort disk adapter (POC) — cover binary storage
<!-- status: in-review -->

**Status:** INTACT -- gerado 2026-08-25
**Maturidade:** 0 -- Inicial
**Done/Total:** 0/4 itens

## Contexto

Implements the `FileStoragePort` disk adapter (interface declared in COMP-005) for the POC
environment. Cover binaries are written to a local writable directory (`COMP_STORAGE_DIR`,
default `./var/covers`). `put` streams the buffer to `<COMP_STORAGE_DIR>/<key>` and returns
a local file URL reference (`capaUrl`). `delete` removes the file and is idempotent on
missing files (ENOENT silently swallowed). The S3-compatible adapter for production is in
INT-COMP-002. Adapter is selected by `COMP_STORAGE_DRIVER=disk|s3`.

## Spec de referencia
- SPEC-02 (cover — FileStoragePort, ADR-003, put/delete signatures)
- `contracts/integration-contracts.md` §2.2 (FileStoragePort disk/S3 adapters)

## Escopo

Files to create (relative to monolith root `backend/`):

- [x] `src/infrastructure/comp/storage/disk-file-storage.adapter.ts` — implements `FileStoragePort`; `put(key, buffer, contentType)`: writes `Buffer` to `path.join(COMP_STORAGE_DIR, key)`; returns `{ url: '/covers/' + key }`; `delete(url)`: derives file path from url; `fs.rm` with `{ force: true }` (no error on ENOENT)
- [x] `src/infrastructure/comp/storage/disk-file-storage.adapter.spec.ts` — put writes file and returns url; delete removes file; delete on missing file → no error thrown
- [x] `src/modules/comp/comp.module.ts` (amend) — register `DiskFileStorageAdapter` under `FILE_STORAGE_PORT` when `COMP_STORAGE_DRIVER=disk` (default)

## Criterios de aceite

- [ ] `put('cover-123.jpg', buffer, 'image/jpeg')` creates file at `COMP_STORAGE_DIR/cover-123.jpg` and returns `{ url: '/covers/cover-123.jpg' }`
- [x] `delete('/covers/nonexistent.jpg')` completes without throwing
- [x] `pnpm test` on adapter spec exits 0

## Dependencias

- COMP-005 (precede — `FileStoragePort` interface declared)

## Estimativa
S

## Prioridade
P4
