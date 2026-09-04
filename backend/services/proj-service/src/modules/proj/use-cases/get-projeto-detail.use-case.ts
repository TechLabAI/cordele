/**
 * GetProjetoDetailUseCase — returns one ProjetoEditorial with all cross-context
 * fields composed from IMP, COMP and PUB (SPEC-03 clause 4).
 *
 * Invariants:
 *  - `status` is ALWAYS taken from PROJ's own row (authority per ADR-002).
 *  - Cross-context fields degrade gracefully (null / []) when any port throws.
 *  - Cross-tenant projetoId returns null (maps to 404 at the controller).
 *
 * RULE-04: this file is in modules/ and must NOT import from infrastructure/.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';

import type { ProjetoEditorialRepository } from '../../../domain/proj/projeto-editorial.repository';
import type { ManuscriptSummaryPort } from '../../../domain/proj/ports/outbound/manuscript-summary.port';
import type { ProjectMetadataPort } from '../../../domain/proj/ports/outbound/project-metadata.port';
import type { PublicationHistoryPort } from '../../../domain/proj/ports/outbound/publication-history.port';
import { ProjetoDetailDto } from '../dto/projeto-detail.dto';
import {
  PROJETO_EDITORIAL_REPOSITORY,
  MANUSCRIPT_SUMMARY_PORT,
  PROJECT_METADATA_PORT,
  PUBLICATION_HISTORY_PORT,
} from '../proj.tokens';
import {
  MANUSCRIPT_SUMMARY_IS_STUB,
  PROJECT_METADATA_IS_STUB,
  PUBLICATION_HISTORY_IS_STUB,
} from '../../../domain/proj/ports/outbound/read-port-flags';

export interface GetProjetoDetailInput {
  readonly projetoId: string;
  readonly empresaId: string;
}

/** null when the project does not exist or belongs to a different empresa. */
export type GetProjetoDetailResult = ProjetoDetailDto | null;

@Injectable()
export class GetProjetoDetailUseCase {
  private readonly logger = new Logger(GetProjetoDetailUseCase.name);

  constructor(
    @Inject(PROJETO_EDITORIAL_REPOSITORY)
    private readonly repository: ProjetoEditorialRepository,
    @Inject(MANUSCRIPT_SUMMARY_PORT)
    private readonly manuscriptPort: ManuscriptSummaryPort,
    @Inject(PROJECT_METADATA_PORT)
    private readonly metadataPort: ProjectMetadataPort,
    @Inject(PUBLICATION_HISTORY_PORT)
    private readonly publicationPort: PublicationHistoryPort,
    @Inject(MANUSCRIPT_SUMMARY_IS_STUB)
    private readonly manuscriptIsStub: boolean,
    @Inject(PROJECT_METADATA_IS_STUB)
    private readonly metadataIsStub: boolean,
    @Inject(PUBLICATION_HISTORY_IS_STUB)
    private readonly historyIsStub: boolean,
  ) {}

  async execute(input: GetProjetoDetailInput): Promise<GetProjetoDetailResult> {
    const project = await this.repository.findById(input.projetoId, input.empresaId);
    if (!project) {
      return null;
    }

    // Pre-set degraded when any port resolved to its stub adapter at startup
    // (stubs return valid defaults but never throw — SPEC-07 fix, Problem 3a).
    let degraded = this.manuscriptIsStub || this.metadataIsStub || this.historyIsStub;
    const markDegraded = () => { degraded = true; };

    // Batched: one call per port even for a single project
    const summaries = await this.callPort(
      () => this.manuscriptPort.summaries([input.projetoId], input.empresaId),
      'ManuscriptSummaryPort',
      new Map(),
      markDegraded,
    );

    const metadataMap = await this.callPort(
      () => this.metadataPort.metadata([input.projetoId], input.empresaId),
      'ProjectMetadataPort',
      new Map(),
      markDegraded,
    );

    const publicationHistory = await this.callPort(
      () => this.publicationPort.history(input.projetoId, input.empresaId),
      'PublicationHistoryPort',
      [],
      markDegraded,
    );

    const summary = summaries.get(input.projetoId) ?? null;
    const meta = metadataMap.get(input.projetoId) ?? null;

    return {
      id: project.id,
      editoraId: project.editoraId,
      nome: project.nome,
      descricao: project.descricao ?? null,
      status: project.status,
      criadoEm: project.criadoEm.toISOString(),
      atualizadoEm: project.atualizadoEm.toISOString(),
      manuscriptSummary: summary,
      metadata: meta,
      publicationHistory,
      degraded,
    };
  }

  private async callPort<T>(
    fn: () => Promise<T>,
    portName: string,
    fallback: T,
    onError: () => void,
  ): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      this.logger.warn(
        `degraded:true port=${portName} error=${(err as Error).message}`,
      );
      onError();
      return fallback;
    }
  }
}
