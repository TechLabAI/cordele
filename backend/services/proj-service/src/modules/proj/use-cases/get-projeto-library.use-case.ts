/**
 * GetProjetoLibraryUseCase — returns the project library (T02) with cross-context
 * fields composed from IMP, COMP and PUB in a single batched round-trip.
 *
 * SPEC-03 clause 1: ordered by ultimaAtividadeEm DESC.
 * SPEC-10 clause 3: exactly ONE call per read-port regardless of project count.
 * SPEC-07: when any port throws, degraded=true and the corresponding card fields
 *          fall back to safe defaults (zeros / null) — the endpoint never fails.
 *
 * RULE-04: this file is in modules/ and must NOT import from infrastructure/.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';

import type { ProjetoStatus } from '../../../domain/proj/value-objects/project-status.vo';
import type {
  ProjetoEditorialRepository,
  ProjetoEditorialFilter,
} from '../../../domain/proj/projeto-editorial.repository';
import type { ManuscriptSummaryPort } from '../../../domain/proj/ports/outbound/manuscript-summary.port';
import type { ProjectMetadataPort } from '../../../domain/proj/ports/outbound/project-metadata.port';
import type { PublicationHistoryPort } from '../../../domain/proj/ports/outbound/publication-history.port';
import { ProjetoCardDto } from '../dto/projeto-card.dto';
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

export interface GetProjetoLibraryInput {
  readonly empresaId: string;
  readonly status?: ProjetoStatus;
  /** Accepted but not enforced in POC (G5 reserve). */
  readonly limit?: number;
  /** Accepted but not enforced in POC (G5 reserve). */
  readonly cursor?: string;
}

export interface GetProjetoLibraryResult {
  readonly cards: ProjetoCardDto[];
  /** True when one or more cross-context ports were unavailable (SPEC-07). */
  readonly degraded: boolean;
}

@Injectable()
export class GetProjetoLibraryUseCase {
  private readonly logger = new Logger(GetProjetoLibraryUseCase.name);

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

  async execute(input: GetProjetoLibraryInput): Promise<GetProjetoLibraryResult> {
    const filter: ProjetoEditorialFilter = input.status
      ? { status: input.status }
      : {};

    const projects = await this.repository.findAll(input.empresaId, filter);
    if (projects.length === 0) {
      return { cards: [], degraded: false };
    }

    const ids = projects.map((p) => p.id);

    // --- Batched cross-context reads: exactly 3 port calls per request ---
    // Pre-set degraded when any port resolved to its stub adapter at startup
    // (stubs return valid defaults but never throw, so callPort's catch would
    // never fire — SPEC-07 fix, Problem 3a).
    let degraded = this.manuscriptIsStub || this.metadataIsStub || this.historyIsStub;
    const markDegraded = () => { degraded = true; };

    const summaries = await this.callPort(
      () => this.manuscriptPort.summaries(ids, input.empresaId),
      'ManuscriptSummaryPort',
      new Map(),
      markDegraded,
    );

    const metadataMap = await this.callPort(
      () => this.metadataPort.metadata(ids, input.empresaId),
      'ProjectMetadataPort',
      new Map(),
      markDegraded,
    );

    const latestMap = await this.callPort(
      () => this.publicationPort.latest(ids, input.empresaId),
      'PublicationHistoryPort',
      new Map(),
      markDegraded,
    );

    const cards: ProjetoCardDto[] = projects.map((p) => {
      const summary = summaries.get(p.id);
      const meta = metadataMap.get(p.id);
      const latest = latestMap.get(p.id);
      return {
        id: p.id,
        nome: p.nome,
        status: p.status,
        autor: meta?.autor ?? null,
        totalCapitulos: summary?.totalCapitulos ?? 0,
        totalImagens: summary?.totalImagens ?? 0,
        ultimoEpubcheckStatus: latest?.epubcheckStatus ?? null,
        ultimaAtividadeEm: p.atualizadoEm.toISOString(),
        criadoEm: p.criadoEm.toISOString(),
      };
    });

    return { cards, degraded };
  }

  /**
   * Calls a port method and catches any exception, setting degraded=true.
   * Guarantees the library endpoint never fails due to a cross-context port.
   */
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
