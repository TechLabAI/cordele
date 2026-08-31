import { Injectable, Logger } from '@nestjs/common';
import { mkdir, writeFile, unlink } from 'fs/promises';
import { dirname, join } from 'path';
import type { FileStoragePort } from '../../../modules/comp/ports/file-storage.port';

/**
 * Local-disk implementation of FileStoragePort (COMP-015 / P4).
 *
 * Stores cover buffers on the local filesystem under COMP_STORAGE_DIR.
 * The storage URL returned is a file:// reference that downstream consumers
 * (e.g. the BDD suite) can resolve locally. In production, this adapter is
 * replaced by S3FileStorageAdapter without any changes to the use cases.
 *
 * Environment variables:
 *   COMP_STORAGE_DIR — base directory for stored files.
 *                       Defaults to "storage/comp" relative to cwd.
 *
 * Behaviour:
 *   store(key, buffer) — writes buffer to COMP_STORAGE_DIR/{key};
 *                         creates the full directory hierarchy if absent;
 *                         returns "file://{absolutePath}" as the capaUrl.
 *   delete(key)        — removes the file at COMP_STORAGE_DIR/{key};
 *                         silences ENOENT (idempotent).
 *
 * RULE-06: outbound file-system access adapter — lives in infrastructure/comp/storage. ✓
 * RULE-01/02: no @prisma/client or @nestjs/common entity imports. ✓
 * RULE-08: no console.log. ✓
 */
@Injectable()
export class DiskFileStorageAdapter implements FileStoragePort {
  private readonly logger = new Logger(DiskFileStorageAdapter.name);
  private readonly storageDir: string;

  constructor() {
    this.storageDir = process.env.COMP_STORAGE_DIR ?? 'storage/comp';
    this.logger.log(`DiskFileStorageAdapter initialised. storageDir=${this.storageDir}`);
  }

  async store(key: string, buffer: Buffer): Promise<string> {
    const absolutePath = join(this.storageDir, key);
    const dir = dirname(absolutePath);

    await mkdir(dir, { recursive: true });
    await writeFile(absolutePath, buffer);

    const url = `file://${absolutePath.replace(/\\/g, '/')}`;
    this.logger.debug(`Stored cover: key=${key} url=${url}`);
    return url;
  }

  async delete(key: string): Promise<void> {
    const absolutePath = join(this.storageDir, key);
    try {
      await unlink(absolutePath);
      this.logger.debug(`Deleted cover: key=${key}`);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        // Idempotent — file already absent, nothing to do.
        this.logger.debug(`delete: key=${key} not found (ENOENT), ignoring`);
        return;
      }
      throw err;
    }
  }
}
