/**
 * Outbound port: PublicationHistoryPort
 *
 * Queries the PUB context for publication records. Three operation groups:
 *   1. `latest(projetoIds)` — batched: one call for the library card list.
 *   2. `history(projetoId)` — single project: full history ordered newest-first.
 *   3. `signedDownloadUrl(publicacaoId)` — obtains a short-TTL signed URL for a
 *      specific publication (only called when epubcheckStatus is valido|avisos).
 *
 * RULE-01: zero @prisma/client imports.
 * RULE-02: zero @nestjs/* imports.
 * RULE-06: the real HTTP adapter lives in src/infrastructure/proj/read/.
 */

/** One publication record from PUB (read-projection). */
export interface PublicationRecord {
  readonly publicacaoId: string;
  readonly projetoId: string;
  /** epubcheck outcome: valido | avisos | erros_criticos | pendente */
  readonly epubcheckStatus: 'valido' | 'avisos' | 'erros_criticos' | 'pendente';
  readonly totalErros: number;
  readonly totalAvisos: number;
  readonly erros?: string | null;
  /** Non-null only for valido|avisos publications in the detail view. */
  readonly arquivoUrl?: string | null;
  /** ISO-8601 UTC creation timestamp. */
  readonly criadoEm: string;
}

/** Minimal publication summary for library card (avoids full record transfer). */
export interface LatestPublicationSummary {
  readonly publicacaoId: string;
  /** epubcheck outcome of the most recent publication. */
  readonly epubcheckStatus: 'valido' | 'avisos' | 'erros_criticos' | 'pendente';
}

/** Result of a signed URL request. */
export interface SignedDownloadUrlResult {
  readonly arquivoUrl: string;
  /** ISO-8601 UTC expiry timestamp. */
  readonly expiresAt: string;
}

/**
 * Port interface for reading publication history from PUB.
 *
 * Implementations:
 *  - Stub (P4): src/infrastructure/stubs/proj/publication-history.stub.ts
 *  - Real HTTP adapter (PROJ-INT-003): src/infrastructure/proj/read/publication-history.adapter.ts
 */
export interface PublicationHistoryPort {
  /**
   * Returns a Map keyed by projetoId with the latest publication summary for each.
   * Projects without publications are absent from the Map.
   * Called ONCE per library request with all projetoIds (batching invariant).
   *
   * @param projetoIds - list of project UUIDs to query
   * @param empresaId  - active tenant
   */
  latest(
    projetoIds: string[],
    empresaId: string,
    bearerToken?: string,
  ): Promise<Map<string, LatestPublicationSummary>>;

  /**
   * Returns the full publication history for one project, ordered by criadoEm DESC.
   * Returns empty array when the project has never been published.
   *
   * @param projetoId   - single project UUID
   * @param empresaId   - active tenant
   * @param bearerToken - JWT bearer from the originating request (forwarded to PUB)
   */
  history(projetoId: string, empresaId: string, bearerToken?: string): Promise<PublicationRecord[]>;

  /**
   * Returns a short-TTL signed URL for downloading the ePub artifact.
   * The PORT itself does not enforce the epubcheck status guard —
   * GetSignedDownloadUrlUseCase (PROJ-013) is responsible for the 409 check
   * before calling this method.
   *
   * @param publicacaoId - UUID of the specific publication
   * @param projetoId    - UUID of the owning project (required by PUB's download endpoint)
   * @param empresaId    - active tenant
   * @param bearerToken  - JWT bearer from the originating request (forwarded to PUB)
   */
  signedDownloadUrl(
    publicacaoId: string,
    projetoId: string,
    empresaId: string,
    bearerToken?: string,
  ): Promise<SignedDownloadUrlResult>;
}

/** DI injection token for PublicationHistoryPort. Re-exported by proj.tokens.ts */
export const PublicationHistoryPort = Symbol('PublicationHistoryPort');
