# INT-COMP-002 -- FileStoragePort S3-compatible adapter (prod path, behind env flag)

**Status:** INTACT -- gerado 2026-08-25
**Maturidade:** 0 -- Inicial
**Done/Total:** 0/3 itens

## Contexto

Implements the S3-compatible `FileStoragePort` adapter for the production environment
(selected by `COMP_STORAGE_DRIVER=s3`). The disk adapter (COMP-015) serves the POC; this
adapter targets an S3-compatible object store (MinIO in dev-prod, AWS S3 in SaaS prod).
Uses the `@aws-sdk/client-s3` SDK. `put` streams the cover buffer to the configured bucket;
`delete` removes the object (idempotent — `NoSuchKey` is silently swallowed). The bucket
name and endpoint are configured via env vars (`COMP_S3_BUCKET`, `COMP_S3_ENDPOINT`,
`COMP_S3_REGION`). The adapter mirrors the disk adapter's interface exactly so no use case
code changes.

## Spec de referencia
- `contracts/integration-contracts.md` §2.2 (FileStoragePort — disk POC / S3-compatible prod)
- SPEC-02 (cover — storage behind port, adapter selection by config)

## Escopo

Files to create (relative to monolith root `backend/`):

- [ ] `src/infrastructure/comp/storage/s3-file-storage.adapter.ts` — implements `FileStoragePort`; initializes `S3Client` with `endpoint`, `region`, `credentials` from env; `put(key, buffer, contentType)`: `PutObjectCommand` → returns `{ url: 'https://<bucket>.s3.../key' }`; `delete(url)`: derives key from url, `DeleteObjectCommand`, catches `NoSuchKey`
- [ ] `src/infrastructure/comp/storage/s3-file-storage.adapter.spec.ts` — S3Client mocked via `aws-sdk-client-mock`; put sends correct PutObjectCommand; delete on missing object → no error
- [ ] `src/modules/comp/comp.module.ts` (amend) — when `COMP_STORAGE_DRIVER=s3`, register `S3FileStorageAdapter` under `FILE_STORAGE_PORT`

## Criterios de aceite

- [ ] `put` calls `PutObjectCommand` with correct `Bucket`, `Key`, `Body`, `ContentType`
- [ ] `delete` with unknown key → `NoSuchKey` exception swallowed; no error thrown
- [ ] Driver selection: `COMP_STORAGE_DRIVER=s3` → S3 adapter registered; `disk` → disk adapter
- [ ] `pnpm test` on adapter spec exits 0

## Dependencias

- COMP-015 (precede — disk adapter establishes FileStoragePort contract; S3 mirrors it)

## Estimativa
S

## Prioridade
P4
