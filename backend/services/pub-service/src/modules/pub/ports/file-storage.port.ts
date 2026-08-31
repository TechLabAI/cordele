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
  put(key: string, content: Buffer | Readable, contentType: string): Promise<{ url: string }>;
  get(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
  signUrl(key: string, ttlSeconds: number): Promise<SignedUrl>;
}

/** DI injection token for FileStoragePort. Re-exported by pub.tokens.ts. */
export const FileStoragePort = Symbol('FileStoragePort');
