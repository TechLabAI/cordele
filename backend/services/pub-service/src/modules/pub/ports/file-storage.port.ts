import type { Readable } from 'node:stream';

export interface SignedUrl {
  readonly url: string;
  readonly expiresAt: string;
}

/**
 * Outbound port: the `.epub` artifact + image reads
 * (integration-contracts.md §3.2, ADR-003).
 *
 * Key scheme: `emp_<slug>/publicacoes/<publicacaoId>/output.epub`, always
 * tenant-scoped from `EmpresaContext` — never a caller-supplied path. A
 * `publicado` row must always have an artifact (data-model.md
 * `chk_publicacao_artefato`): if storage fails after a valid build, the
 * caller must record `com_erros` instead.
 *
 * Adapter (`DiskFileStorageAdapter`, PUB-011) binds in P4. P2 use cases are
 * tested against Jest mocks of this interface.
 */
export interface FileStoragePort {
  /**
   * Stores `content` under `key`. Returns the internal URL and the number of
   * bytes written to storage (ADR-004: `bytesWritten` feeds `tamanho_bytes` on
   * the `publicacao` row via `PublicationBuildJob`).
   */
  put(key: string, content: Buffer | Readable, contentType: string): Promise<{ url: string; bytesWritten: number }>;
  get(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
  signUrl(key: string, ttlSeconds: number): Promise<SignedUrl>;
}

/** DI injection token for FileStoragePort. Re-exported by pub.tokens.ts. */
export const FileStoragePort = Symbol('FileStoragePort');
