/**
 * PublicationFailedEvent — domain event emitted after a Publicacao reaches
 * the `com_erros` terminal state and its failure outcome is durably persisted.
 *
 * RULE-01/RULE-02: plain TypeScript class — no @nestjs/* decorators,
 * no @prisma/client imports. All fields are value-object primitives.
 *
 * Carries `empresaId` so downstream handlers can reconstruct the
 * EmpresaContext without relying on AsyncLocalStorage (which is absent
 * outside the original request thread — multi-empresa propagation rule).
 */
export class PublicationFailedEvent {
  /** Canonical identifier of the Publicacao aggregate. */
  readonly publicacaoId: string;

  /** Project that owns this publication. */
  readonly projetoId: string;

  /** Empresa (tenant) that originated the build job. */
  readonly empresaId: string;

  /** Human-readable failure reason (epubcheck error, storage failure, etc.). */
  readonly reason: string;

  constructor(params: {
    publicacaoId: string;
    projetoId: string;
    empresaId: string;
    reason: string;
  }) {
    this.publicacaoId = params.publicacaoId;
    this.projetoId = params.projetoId;
    this.empresaId = params.empresaId;
    this.reason = params.reason;
  }
}
