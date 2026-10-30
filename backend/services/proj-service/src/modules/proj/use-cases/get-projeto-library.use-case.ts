/**
 * GetProjetoLibraryUseCase — returns a paginated project library (T02) with
 * cross-context fields composed from IMP, COMP and PUB in a single batched
 * round-trip per page.
 *
 * SPEC-03 clause 1: ordered by ultimaAtividadeEm DESC (tiebreak: id ASC for
 *   deterministic keyset pagination).
 * SPEC-10 clause 3: exactly ONE call per read-port per page (batch of page IDs).
 * SPEC-07: when any port throws, degraded=true and the corresponding card fields
 *   fall back to safe defaults (zeros / null) — the endpoint never fails.
 *
 * Pagination (keyset / cursor-based):
 *   Default page size: LIBRARY_DEFAULT_PAGE_SIZE (25).
 *   Max page size:     LIBRARY_MAX_PAGE_SIZE (50).
 *   Choosing max=50 is deliberate: 50 = CROSS_SERVICE_BATCH_LIMIT used by the
 *   three HTTP adapters. A page of ≤ 50 projects fits in exactly ONE batch
 *   request per downstream service, making chunking the safety net rather than
 *   the normal path.
 *
 *   The use case fetches `limit + 1` rows from the repository; if the count
 *   exceeds `limit` there is at least one more page, and a `nextCursor` is
 *   generated from the last row of the current page. The cursor is opaque to
 *   callers: base64(JSON({atualizadoEm: ISO-8601, id: UUID})).
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
import { PartialResultError } from '../../../domain/shared/partial-result.error';

/**
 * Default number of items returned when no limit is specified.
 * Fits comfortably in a single screen without scrolling.
 */
export const LIBRARY_DEFAULT_PAGE_SIZE = 25;

/**
 * Maximum number of items the use case will return in a single page.
 * Set equal to CROSS_SERVICE_BATCH_LIMIT (50) so that any page fits in
 * exactly one HTTP chunk per downstream service — chunking becomes a safety
 * net (for old unbounded callers) rather than the normal path.
 */
export const LIBRARY_MAX_PAGE_SIZE = 50;

export interface GetProjetoLibraryInput {
  readonly empresaId: string;
  readonly status?: ProjetoStatus;
  /** JWT bearer from the originating HTTP request, forwarded to cross-context ports. */
  readonly bearerToken?: string;
  /** Number of items per page. Validated and clamped by the controller before reaching here. */
  readonly limit?: number;
  /** Opaque cursor from the previous page's nextCursor field. */
  readonly cursor?: string;
}

export interface GetProjetoLibraryResult {
  readonly cards: ProjetoCardDto[];
  /** True when one or more cross-context ports were unavailable (SPEC-07). */
  readonly degraded: boolean;
  /**
   * Opaque cursor to pass as `cursor` on the next request to retrieve the
   * following page. Null when this is the last page (or the only page).
   */
  readonly nextCursor: string | null;
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
    const pageSize = input.limit ?? LIBRARY_DEFAULT_PAGE_SIZE;

    const filter: ProjetoEditorialFilter = {
      ...(input.status ? { status: input.status } : {}),
      // Fetch one extra row so we know whether a next page exists.
      limit: pageSize + 1,
      ...(input.cursor ? { cursor: input.cursor } : {}),
    };

    const rawProjects = await this.repository.findAll(input.empresaId, filter);

    // Determine if there is a next page and slice to the requested page size.
    const hasNextPage = rawProjects.length > pageSize;
    const projects = hasNextPage ? rawProjects.slice(0, pageSize) : rawProjects;

    if (projects.length === 0) {
      return { cards: [], degraded: false, nextCursor: null };
    }

    // Generate cursor from the last item on this page.
    const lastProject = projects[projects.length - 1];
    const nextCursor = hasNextPage
      ? Buffer.from(
          JSON.stringify({
            atualizadoEm: lastProject.atualizadoEm.toISOString(),
            id: lastProject.id,
          }),
        ).toString('base64')
      : null;

    const ids = projects.map((p) => p.id);

    // --- Batched cross-context reads: exactly 3 port calls per page ---
    // Pre-set degraded when any port resolved to its stub adapter at startup
    // (stubs return valid defaults but never throw, so callPort's catch would
    // never fire — SPEC-07 fix, Problem 3a).
    let degraded = this.manuscriptIsStub || this.metadataIsStub || this.historyIsStub;
    const markDegraded = () => { degraded = true; };

    const summaries = await this.callPort(
      () => this.manuscriptPort.summaries(ids, input.empresaId, input.bearerToken),
      'ManuscriptSummaryPort',
      new Map(),
      markDegraded,
    );

    const metadataMap = await this.callPort(
      () => this.metadataPort.metadata(ids, input.empresaId, input.bearerToken),
      'ProjectMetadataPort',
      new Map(),
      markDegraded,
    );

    const latestMap = await this.callPort(
      () => this.publicationPort.latest(ids, input.empresaId, input.bearerToken),
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

    return { cards, degraded, nextCursor };
  }

  /**
   * Calls a port method and catches any exception, setting degraded=true.
   * Guarantees the library endpoint never fails due to a cross-context port.
   *
   * Two degradation paths:
   *  1. PartialResultError<T> — some chunks succeeded and some failed. The
   *     partial data is returned so the library shows correct data for projects
   *     whose chunk succeeded. degraded=true so X-Degraded header is emitted.
   *  2. Any other Error — all chunks failed (or single-shot failure). The
   *     fallback value is returned (empty Map) and degraded=true.
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
      if (err instanceof PartialResultError) {
        this.logger.warn(
          `degraded:true port=${portName} partial=${err.failedChunks}/${err.totalChunks} chunks failed`,
        );
        onError();
        return err.partial as T;
      }
      this.logger.warn(
        `degraded:true port=${portName} error=${(err as Error).message}`,
      );
      onError();
      return fallback;
    }
  }
}
