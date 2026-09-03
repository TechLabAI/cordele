/**
 * PublicationSucceededEvent — domain event emitted after a Publicacao reaches
 * the `publicado` terminal state and its outcome is durably persisted.
 *
 * RULE-01/RULE-02: plain TypeScript class — no @nestjs/* decorators,
 * no @prisma/client imports. All fields are value-object primitives.
 *
 * Carries `empresaId` so downstream handlers can reconstruct the
 * EmpresaContext without relying on AsyncLocalStorage (which is absent
 * outside the original request thread — multi-empresa propagation rule).
 */
export class PublicationSucceededEvent {
  /** Canonical identifier of the Publicacao aggregate. */
  readonly publicacaoId: string;

  /** Project that owns this publication. */
  readonly projetoId: string;

  /** Empresa (tenant) that originated the build job. */
  readonly empresaId: string;

  /** Size of the produced .epub artifact in bytes. */
  readonly tamanhoBytes: number;

  /** Number of XHTML chapter documents assembled into the OCF package. */
  readonly totalCapitulos: number;

  /** Number of image resources embedded in the OCF package. */
  readonly totalImagens: number;

  constructor(params: {
    publicacaoId: string;
    projetoId: string;
    empresaId: string;
    tamanhoBytes: number;
    totalCapitulos: number;
    totalImagens: number;
  }) {
    this.publicacaoId = params.publicacaoId;
    this.projetoId = params.projetoId;
    this.empresaId = params.empresaId;
    this.tamanhoBytes = params.tamanhoBytes;
    this.totalCapitulos = params.totalCapitulos;
    this.totalImagens = params.totalImagens;
  }
}
