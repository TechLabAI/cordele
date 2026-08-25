/**
 * CreateProjetoEditorialUseCase — golden path for project creation.
 *
 * Implements the inbound port CreateProjetoEditorialPort so IMP can call
 * `create({ titulo })` without importing this class directly (ADR-001).
 *
 * Business rules (api-contract §4.1 / SPEC-01):
 *   - `nome` must be non-empty, max 200 chars.
 *   - `editoraId` is resolved from UsuarioContext (never from request body — RULE-07).
 *   - Persists via ProjetoEditorialRepository (injected port — never imports Prisma).
 *   - Emits ProjectCreated after commit (EventEmitter pattern — SPEC-05).
 *
 * RULE-04: this file is in modules/ and does NOT import from infrastructure/.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { ProjetoStatus } from '../../../domain/proj/value-objects/project-status.vo';
import { ProjectCreatedEvent } from '../../../domain/proj/events/project-created.event';
import {
  ProjetoEditorialRepository,
  type ProjetoEditorialData,
} from '../../../domain/proj/projeto-editorial.repository';
import { type UsuarioContext } from '../../../domain/shared/usuario-context.interface';
import { type CreateProjetoEditorialPort } from '../../../domain/proj/ports/inbound/create-projeto-editorial.port';
import { PROJETO_EDITORIAL_REPOSITORY, PROJECT_EVENT_PUBLISHER } from '../proj.tokens';
import { type IProjectEventPublisher } from '../proj.event-publisher.interface';

/** Input for the REST handler (and also the port contract for IMP). */
export interface CreateProjetoEditorialInput {
  readonly nome: string;
  readonly descricao?: string;
}

@Injectable()
export class CreateProjetoEditorialUseCase implements CreateProjetoEditorialPort {
  private readonly logger = new Logger(CreateProjetoEditorialUseCase.name);

  constructor(
    @Inject(PROJETO_EDITORIAL_REPOSITORY)
    private readonly repository: ProjetoEditorialRepository,
    @Inject(PROJECT_EVENT_PUBLISHER)
    private readonly eventPublisher: IProjectEventPublisher,
  ) {}

  /**
   * Creates a new ProjetoEditorial in status `rascunho`.
   *
   * @param input - title + optional description
   * @param user  - authenticated caller; empresaId resolves the owning empresa
   * @returns the persisted project data
   * @throws {Error} when nome is empty or exceeds 200 characters
   */
  async execute(
    input: CreateProjetoEditorialInput,
    user: UsuarioContext,
  ): Promise<ProjetoEditorialData> {
    this.validate(input);

    const id = randomUUID();

    const projeto = await this.repository.create({
      id,
      nome: input.nome.trim(),
      descricao: input.descricao,
      editoraId: user.empresaId,
      status: ProjetoStatus.rascunho,
    });

    // Emit ProjectCreated post-persist (listener runs async, outside transaction).
    const event = new ProjectCreatedEvent({
      eventId: randomUUID(),
      occurredAt: new Date().toISOString(),
      projetoId: projeto.id,
      editoraId: projeto.editoraId,
      nome: projeto.nome,
    });
    this.eventPublisher.publish('ProjectCreated', event);
    this.logger.log(`ProjetoEditorial created: ${projeto.id}`);

    return projeto;
  }

  /**
   * In-process port signature called by IMP (integration-contracts §1.1).
   * Creates project with `titulo` as nome.
   */
  async create(input: { titulo: string }): Promise<{ projetoId: string }> {
    // IMP calls this without a full UsuarioContext — editoraId is carried by
    // EmpresaContext (AsyncLocalStorage). P5 will wire the context properly;
    // for P2 we propagate an empty context so unit tests can verify the call.
    const id = randomUUID();
    const projeto = await this.repository.create({
      id,
      nome: input.titulo.trim(),
      editoraId: 'context-resolved', // replaced by EmpresaContext in P5
      status: ProjetoStatus.rascunho,
    });

    const event = new ProjectCreatedEvent({
      eventId: randomUUID(),
      occurredAt: new Date().toISOString(),
      projetoId: projeto.id,
      editoraId: projeto.editoraId,
      nome: projeto.nome,
    });
    this.eventPublisher.publish('ProjectCreated', event);

    return { projetoId: projeto.id };
  }

  private validate(input: CreateProjetoEditorialInput): void {
    const nome = input.nome?.trim() ?? '';
    if (!nome || nome.length === 0) {
      throw Object.assign(new Error('nome is required and cannot be empty'), {
        type: 'urn:cordele:proj:validation',
        field: 'nome',
      });
    }
    if (nome.length > 200) {
      throw Object.assign(new Error('nome must not exceed 200 characters'), {
        type: 'urn:cordele:proj:validation',
        field: 'nome',
      });
    }
  }
}
