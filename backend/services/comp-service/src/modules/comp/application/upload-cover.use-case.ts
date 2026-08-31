import { Inject, Injectable, Logger } from '@nestjs/common';

import { Metadados } from '../../../domain/comp/metadados.aggregate';
import { DomainException } from '../../../domain/shared/domain-exception';
import type { MetadadosRepository } from '../ports/metadados-repository.port';
import type { FileStoragePort } from '../ports/file-storage.port';
import type { DomainEventEmitter } from '../ports/domain-event-emitter.port';
import {
  COMP_METADADOS_REPO,
  COMP_FILE_STORAGE_PORT,
  COMP_EVENT_EMITTER,
  COMP_METRICS_SERVICE,
} from '../comp.tokens';

export interface UploadCoverInput {
  readonly projetoId: string;
  readonly empresaSlug: string;
  readonly buffer: Buffer;
  readonly mimeType: string;
}

export interface UploadCoverOutput {
  readonly capaUrl: string;
  readonly atualizadoEm: Date;
}

/** Allowed MIME types for cover images (COMP-005 / SPEC-02). */
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Extension map for allowed MIME types. */
const MIME_EXTENSIONS: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Default max cover size: 10 MB (10 485 760 bytes). Overridable via env. */
const DEFAULT_MAX_BYTES = 10_485_760;

/**
 * Stores a cover image and updates capaUrl in Metadados (COMP-005, T05, D-L, api-contract §4.3).
 *
 * Design:
 *   - Validates MIME type before any storage call (415 if unsupported).
 *   - Validates file size against COMP_COVER_MAX_BYTES (413 if too large).
 *   - Cover binary is stored via FileStoragePort — never in the DB row (ADR-003).
 *   - Storage key: `{empresaSlug}/{projetoId}/capa.{ext}` derived from the MIME type.
 *   - A second upload replaces the previous cover (idempotent per project).
 *   - The use case stores the file BEFORE updating the DB row so that a DB failure
 *     leaves no dangling capaUrl (best-effort; a file GC job handles orphaned files).
 *   - Emits 'MetadataUpdated' post-persist (COMP-004/005 event contract).
 *   - Increments comp_cover_rejection_total{reason} on rejection and
 *     comp_cover_upload_total on success (COMP-019).
 *
 * RULE-04: this file is in modules/ and does NOT import from infrastructure/ repositories.
 */
@Injectable()
export class UploadCoverUseCase {
  private readonly logger = new Logger(UploadCoverUseCase.name);

  constructor(
    @Inject(COMP_METADADOS_REPO)
    private readonly metadadosRepo: MetadadosRepository,
    @Inject(COMP_FILE_STORAGE_PORT)
    private readonly fileStorage: FileStoragePort,
    @Inject(COMP_EVENT_EMITTER)
    private readonly eventEmitter: DomainEventEmitter,
    @Inject(COMP_METRICS_SERVICE)
    private readonly metrics: { increment(metric: string, labels?: Record<string, string>): void },
  ) {}

  async execute(input: UploadCoverInput): Promise<UploadCoverOutput> {
    this.logger.debug(`UploadCover projetoId=${input.projetoId} mimeType=${input.mimeType}`);

    // ── Validation (COMP-005 / SPEC-02) ───────────────────────────────────────
    // Both checks happen BEFORE any FileStoragePort call (defense-in-depth).

    if (!ALLOWED_MIME_TYPES.includes(input.mimeType as typeof ALLOWED_MIME_TYPES[number])) {
      this.metrics.increment('comp_cover_rejection_total', { reason: '415' });
      throw new DomainException(
        'UNSUPPORTED_MEDIA_TYPE',
        415,
        `Unsupported media type: ${input.mimeType}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    const maxBytes = parseInt(process.env['COMP_COVER_MAX_BYTES'] ?? String(DEFAULT_MAX_BYTES), 10);
    if (input.buffer.length > maxBytes) {
      this.metrics.increment('comp_cover_rejection_total', { reason: '413' });
      throw new DomainException(
        'PAYLOAD_TOO_LARGE',
        413,
        `File size ${input.buffer.length} bytes exceeds maximum ${maxBytes} bytes`,
      );
    }

    // ── Store binary first ───────────────────────────────────────────────────
    // If the DB update fails afterwards, the file exists but capaUrl is not set.
    // A background GC job is responsible for cleaning up orphaned files.
    const ext = MIME_EXTENSIONS[input.mimeType] ?? 'bin';
    const key = `${input.empresaSlug}/${input.projetoId}/capa.${ext}`;
    const capaUrl = await this.fileStorage.store(key, input.buffer);

    // ── Update Metadados row ─────────────────────────────────────────────────
    const existing = await this.metadadosRepo.findByProjetoId(input.projetoId);
    const base = existing ?? Metadados.defaultsFor(input.projetoId, input.empresaSlug);
    const updated = base.withCapaUrl(capaUrl);

    const persisted = await this.metadadosRepo.upsert(updated);

    // ── Post-persist side effects ────────────────────────────────────────────
    this.eventEmitter.emit('MetadataUpdated', {
      projetoId: persisted.projetoId,
      empresaSlug: persisted.empresaSlug,
      capaUrl: persisted.capaUrl,
    });

    this.metrics.increment('comp_cover_upload_total');

    return {
      capaUrl: persisted.capaUrl!,
      atualizadoEm: persisted.atualizadoEm,
    };
  }
}
