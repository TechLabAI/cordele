import { Global, Module } from '@nestjs/common';

import { FileStoragePort } from '../../../modules/pub/ports/file-storage.port';
import { DiskFileStorageAdapter } from './disk-file-storage.adapter';

/**
 * StorageModule — registers the disk-backed adapter for `FileStoragePort`
 * (PUB-011, P4).
 *
 * Decorated `@Global()` so `PubModule`'s use cases (and `EpubBuilder` via
 * the build job) receive the token from the global scope without importing
 * infrastructure/ directly (RULE-04 / RULE-05).
 *
 * Environment variables consumed by `DiskFileStorageAdapter`:
 *   - `PUB_STORAGE_ROOT`               — base directory for artifact storage
 *   - `PUB_DOWNLOAD_URL_TTL_SECONDS`   — default signed-URL TTL (default: 900s)
 *   - `PUB_SIGN_SECRET`                — HMAC key for signed URLs
 *
 * In production, replace `DiskFileStorageAdapter` with an S3-backed adapter
 * here — no domain or application code changes required (ADR-003).
 */
@Global()
@Module({
  providers: [
    DiskFileStorageAdapter,
    {
      provide: FileStoragePort,
      useExisting: DiskFileStorageAdapter,
    },
  ],
  exports: [FileStoragePort],
})
export class StorageModule {}
