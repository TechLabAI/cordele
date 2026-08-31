import type { FileStoragePort } from '../../../modules/comp/ports/file-storage.port';

/**
 * S3 adapter for FileStoragePort (INT-COMP-002 / post-POC placeholder).
 *
 * This stub is intentionally not implemented. Activate it in AppModule by
 * replacing DiskFileStorageAdapter with this class once:
 *   1. An S3-compatible SDK (@aws-sdk/client-s3 or MinIO) is added as a
 *      project dependency.
 *   2. COMP_S3_BUCKET and AWS_REGION (or equivalent) env vars are configured.
 *   3. The DiskFileStorageAdapter is removed from the AppModule providers.
 *
 * No changes to use cases are required — the swap is purely in AppModule.
 *
 * RULE-06: outbound storage client — lives in infrastructure/comp/storage. ✓
 */
export class S3FileStorageAdapter implements FileStoragePort {
  store(_key: string, _buffer: Buffer): Promise<string> {
    throw new Error('NOT_IMPLEMENTED: S3FileStorageAdapter — see INT-COMP-002');
  }

  delete(_key: string): Promise<void> {
    throw new Error('NOT_IMPLEMENTED: S3FileStorageAdapter — see INT-COMP-002');
  }
}
