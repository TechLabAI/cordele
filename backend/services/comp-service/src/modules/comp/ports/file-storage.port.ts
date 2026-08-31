/**
 * Outbound port for binary file storage (cover images) — COMP-005.
 *
 * The cover binary is never stored in the DB row — only a reference URL is kept
 * in metadados.capaUrl (ADR-003, D-L). COMP accesses covers exclusively through
 * this port.
 *
 * Concrete adapters:
 *   - DiskFileStorageAdapter (local FS): for POC / local development.
 *   - S3FileStorageAdapter (post-POC placeholder): cloud storage.
 *
 * Pure TypeScript interface — no @nestjs/* or @prisma/client imports (RULE-01/02).
 */
export interface FileStoragePort {
  /**
   * Stores a buffer under the given key and returns the public/storage URL.
   *
   * The key is derived by the use case from the empresaSlug and projetoId
   * (e.g. `{slug}/{projetoId}/capa.{ext}`). The adapter must create any
   * required directory structure.
   *
   * @param key    Storage key (relative path or object name).
   * @param buffer Binary content to store.
   * @returns      The URL by which the stored file can be referenced (capaUrl).
   */
  store(key: string, buffer: Buffer): Promise<string>;

  /**
   * Removes the file at the given key.
   * Idempotent: silences NOT_FOUND / ENOENT — callers do not need to check
   * existence before calling delete.
   *
   * @param key  The storage key returned by a previous `store` call, OR
   *             a capaUrl that can be resolved to a storage key by the adapter.
   */
  delete(key: string): Promise<void>;
}
