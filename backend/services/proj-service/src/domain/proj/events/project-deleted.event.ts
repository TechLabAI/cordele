/**
 * Domain event emitted after a ProjetoEditorial and its full LGPD erasure
 * cascade (PUB → COMP → IMP → DB delete) are committed.
 *
 * Pure domain type — no @nestjs/* or @prisma/client imports (RULE-01 / RULE-02).
 * Emitted by DeleteProjetoUseCase (P6 / PROJ-016) only after every erasure
 * step succeeds and the projeto_editorial row is deleted.
 */
export class ProjectDeletedEvent {
  /** UUID v4 — unique per emission; used to detect duplicate deliveries. */
  readonly eventId: string;
  /** RFC 3339 UTC timestamp of when the event occurred. */
  readonly occurredAt: string;
  /** Identifier of the deleted ProjetoEditorial. */
  readonly projetoId: string;
  /** Empresa that owned the project. */
  readonly editoraId: string;
  /** User or system actor that requested the deletion. */
  readonly solicitadoPor: string;

  constructor(params: {
    eventId: string;
    occurredAt: string;
    projetoId: string;
    editoraId: string;
    solicitadoPor: string;
  }) {
    this.eventId = params.eventId;
    this.occurredAt = params.occurredAt;
    this.projetoId = params.projetoId;
    this.editoraId = params.editoraId;
    this.solicitadoPor = params.solicitadoPor;
  }
}
