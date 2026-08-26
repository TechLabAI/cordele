/**
 * Thrown when a download URL is requested for a publication whose artifact is
 * not available for download.
 *
 * Publications in status `erros_criticos` or `pendente` have no ePub artifact
 * ready; requesting a signed URL for them must yield 409 (api-contract §4.5 / D-F).
 *
 * Pure domain error — no @nestjs/* or @prisma/client imports (RULE-01 / RULE-02).
 * REST callers map this to 409 urn:cordele:proj:artifact-not-available.
 */
export class ArtifactNotAvailableError extends Error {
  /** The publication that was requested. */
  readonly publicacaoId: string;
  /** The epubcheck status that prevented the download. */
  readonly epubcheckStatus: string;

  constructor(publicacaoId: string, epubcheckStatus: string) {
    super(
      `Publication ${publicacaoId} cannot be downloaded: epubcheckStatus is '${epubcheckStatus}'.` +
        ' Only valido|avisos publications have a downloadable artifact.',
    );
    this.name = 'ArtifactNotAvailableError';
    this.publicacaoId = publicacaoId;
    this.epubcheckStatus = epubcheckStatus;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
