import { createHmac, randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { FileStoragePort, SignedUrl } from '../../../modules/pub/ports/file-storage.port';

/**
 * DiskFileStorageAdapter — POC disk-backed implementation of `FileStoragePort`
 * (PUB-011, P4, ADR-003).
 *
 * ### Key scheme (SPEC-06 tenant-scoped)
 * Keys are caller-supplied and always include the empresa slug:
 *   `emp_<slug>/publicacoes/<publicacaoId>/output.epub`
 * The adapter never interprets the key — it maps it directly to a sub-path
 * under `PUB_STORAGE_ROOT`. Cross-empresa isolation is enforced by the slug
 * in the key, not by directory ACLs.
 *
 * ### Signed URLs (SPEC-06 TTL)
 * `signUrl` produces an HMAC-SHA256 token over `key + expiresAt`. The token
 * is checked in `PubController.downloadArtifact` (P5/P6). URL format:
 *   GET /api/pub/internal/download?key=<key>&token=<hex>&expires=<epoch-ms>
 *
 * ### Idempotence
 * `delete` swallows `ENOENT` — required by `PublicationErasurePort.purge`
 * (data-model.md `chk_publicacao_artefato`: artefato may already be absent
 * when purge is retried after a partial failure).
 *
 * ### Production upgrade
 * Replace this adapter with an S3-backed implementation by swapping the
 * provider in `StorageModule` — domain and application layers are unaffected
 * (hexagonal boundary, ADR-003).
 *
 * RULE-05: imports only from domain/pub (enums) and modules/pub/ports/
 * (interface type — no implementation from modules/).
 */
@Injectable()
export class DiskFileStorageAdapter implements FileStoragePort {
  private readonly logger = new Logger(DiskFileStorageAdapter.name);
  private readonly storageRoot: string;
  private readonly signSecret: string;
  private readonly defaultTtlSeconds: number;

  constructor(private readonly config: ConfigService) {
    this.storageRoot = this.config.get<string>('PUB_STORAGE_ROOT') ?? join(process.cwd(), '.pub-storage');
    this.signSecret = this.config.get<string>('PUB_SIGN_SECRET') ?? randomBytes(32).toString('hex');
    this.defaultTtlSeconds = this.config.get<number>('PUB_DOWNLOAD_URL_TTL_SECONDS') ?? 900;
  }

  /**
   * Stores content at `key` under the storage root. Creates parent directories as needed.
   *
   * ADR-004: retorna `bytesWritten` (tamanho real do arquivo escrito) junto com a `url`,
   * para que o `PublicationBuildJob` possa persistir `tamanho_bytes` no aggregate sem
   * precisar inspecionar o arquivo depois do write.
   */
  async put(key: string, content: Buffer | Readable, _contentType: string): Promise<{ url: string; bytesWritten: number }> {
    const filePath = join(this.storageRoot, key);
    await mkdir(join(filePath, '..'), { recursive: true });

    let bytesWritten: number;
    if (Buffer.isBuffer(content)) {
      await writeFile(filePath, content);
      bytesWritten = content.byteLength;
    } else {
      // Readable stream: collect to Buffer then write (POC; in S3 adapter use multipart upload)
      const buf = await streamToBuffer(content);
      await writeFile(filePath, buf);
      bytesWritten = buf.byteLength;
    }

    this.logger.debug(`FileStorage: put key="${key}" path="${filePath}" bytesWritten=${bytesWritten}`);
    return { url: `/api/pub/internal/download?key=${encodeURIComponent(key)}`, bytesWritten };
  }

  /**
   * Returns a Readable stream for the file at `key`.
   * Used by EpubBuilder to load images embedded in the manuscript (IMP storage).
   */
  async get(key: string): Promise<Readable> {
    const filePath = join(this.storageRoot, key);
    return createReadStream(filePath);
  }

  /**
   * Deletes the file at `key`. Silently ignores `ENOENT` (idempotent delete
   * required by `PublicationErasurePort.purge` — PUB-015, data-model.md).
   */
  async delete(key: string): Promise<void> {
    const filePath = join(this.storageRoot, key);
    try {
      await unlink(filePath);
      this.logger.debug(`FileStorage: deleted key="${key}"`);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
      // ENOENT is expected and silently absorbed (idempotent)
    }
  }

  /**
   * Generates a short-lived signed URL for downloading the artefact at `key`.
   *
   * The URL embeds an HMAC-SHA256 signature over `key + expiresAt` to prevent
   * tampering. `PubController.downloadArtifact` verifies the token before
   * streaming the file (P5/P6 scope — download endpoint wired up there).
   *
   * @param key        Storage key of the artifact.
   * @param ttlSeconds Time-to-live in seconds (overrides `PUB_DOWNLOAD_URL_TTL_SECONDS`).
   */
  async signUrl(key: string, ttlSeconds: number): Promise<SignedUrl> {
    const ttl = ttlSeconds > 0 ? ttlSeconds : this.defaultTtlSeconds;
    const expiresAt = new Date(Date.now() + ttl * 1_000).toISOString();
    const expiresMs = new Date(expiresAt).getTime().toString();

    const token = createHmac('sha256', this.signSecret)
      .update(`${key}:${expiresMs}`)
      .digest('hex');

    const url =
      `/api/pub/internal/download` +
      `?key=${encodeURIComponent(key)}` +
      `&token=${token}` +
      `&expires=${expiresMs}`;

    return { url, expiresAt };
  }
}

// ─── Module-level helpers ─────────────────────────────────────────────────────

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer | string) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
    );
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}
