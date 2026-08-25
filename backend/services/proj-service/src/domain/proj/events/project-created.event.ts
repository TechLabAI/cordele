/**
 * Domain event emitted after a ProjetoEditorial is created and committed.
 *
 * Pure domain type — no @nestjs/* or @prisma/client imports (RULE-01 / RULE-02).
 * The event is fired by the application service using NestJS EventEmitter2 post-commit
 * so the listener runs outside the transaction (SPEC-05 / api-contract §7).
 */
export class ProjectCreatedEvent {
  /** UUID v4 — unique per emission; used to detect duplicate deliveries. */
  readonly eventId: string;
  /** RFC 3339 UTC timestamp of when the event occurred. */
  readonly occurredAt: string;
  /** Identifier of the newly created ProjetoEditorial. */
  readonly projetoId: string;
  /** Empresa that owns the project (resolved from JWT claim, never from body). */
  readonly editoraId: string;
  /** Title of the project. */
  readonly nome: string;
  /** Always "rascunho" for creation events. */
  readonly status: 'rascunho';

  constructor(params: {
    eventId: string;
    occurredAt: string;
    projetoId: string;
    editoraId: string;
    nome: string;
  }) {
    this.eventId = params.eventId;
    this.occurredAt = params.occurredAt;
    this.projetoId = params.projetoId;
    this.editoraId = params.editoraId;
    this.nome = params.nome;
    this.status = 'rascunho';
  }
}
