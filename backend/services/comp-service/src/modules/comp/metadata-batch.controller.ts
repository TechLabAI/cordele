import { Body, Controller, HttpCode, HttpStatus, Inject, Logger, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { RequiredScopes } from './decorators/require-scope.decorator';
import { COMP_PROJECT_METADATA_PORT } from './comp.tokens';
import { MetadataBatchRequestDto } from './dto/metadata-batch-request.dto';
import { MetadataBatchResponseItemDto } from './dto/metadata-batch-response.dto';
import type { ProjectMetadataPort } from '../../domain/ports/project-metadata.port';

/**
 * HTTP adapter for the COMP batch metadata query (COMP-017 / api-contract §4.8).
 *
 * Exposes `ProjectMetadataPort.metadata()` as a REST endpoint so that PROJ
 * (and any future caller) can retrieve author metadata for a list of projects
 * in **one** HTTP call backed by **one** DB query (no N+1).
 *
 * Why a separate controller, not a handler in CompController?
 * ──────────────────────────────────────────────────────────────
 * `CompController` is `@Controller({ path: 'comp/projetos/:projetoId', … })`.
 * Every route in that controller carries the `:projetoId` path parameter.
 * The batch endpoint operates on a *list* of IDs supplied in the request body
 * and has no single `:projetoId` segment in its path (`/api/v1/comp/metadata/batch`).
 * Adding it to `CompController` would require stripping the param from that
 * controller's prefix (breaking the existing 7 routes) or using an absolute path
 * override — both options introduce more complexity than a dedicated controller.
 * A second controller at path `comp/metadata` is the cleanest, most explicit
 * solution and does not require any change to the existing 7 routes.
 *
 * Security:
 *  - `JwtAuthGuard` (APP_GUARD) enforces 401 on missing/invalid token.
 *  - `ScopeGuard` (APP_GUARD) enforces 403 when `comp:read` is absent.
 *  - `EmpresaContextInterceptor` (APP_INTERCEPTOR) populates the ALS tenant
 *    context from `request.user.empresaId` before the handler runs (RULE-07).
 *    The repository reads the slug from ALS — no explicit empresa arg needed.
 *
 * Multi-empresa: handled transparently by the ALS + PrismaEmpresaService chain.
 * RULE-04: does not import infrastructure/ directly. ✓
 */
@ApiTags('comp')
@ApiBearerAuth('bearer')
@Controller({ path: 'comp/metadata', version: '1' })
export class MetadataBatchController {
  private readonly logger = new Logger(MetadataBatchController.name);

  constructor(
    @Inject(COMP_PROJECT_METADATA_PORT)
    private readonly projectMetadataPort: ProjectMetadataPort,
  ) {}

  /**
   * POST /api/v1/comp/metadata/batch
   *
   * Returns author metadata for the requested project IDs.
   *
   * Projects with no persisted `Metadados` row are **omitted** from the result
   * array — absence signals "no metadata" to the consumer. Callers (PROJ's
   * CompProjectMetadataAdapter) must treat a missing entry as `autor: null`
   * (consistent with the Map-based in-process contract).
   *
   * The underlying use case issues a single `findMany` query regardless of list
   * size — 0 IDs short-circuits before hitting the DB (returns []).
   *
   * Scope: comp:read
   */
  @Post('batch')
  @RequiredScopes('comp:read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Batch metadata query for a list of project IDs (COMP-017)' })
  @ApiOkResponse({
    type: [MetadataBatchResponseItemDto],
    description:
      'Array of metadata items for projects that have a persisted Metadados row. ' +
      'Projects with no row are absent from the array.',
  })
  async batchMetadata(
    @Body() dto: MetadataBatchRequestDto,
  ): Promise<MetadataBatchResponseItemDto[]> {
    this.logger.log(`POST metadata/batch count=${dto.projetoIds.length}`);

    if (dto.projetoIds.length === 0) {
      return [];
    }

    const metadataMap = await this.projectMetadataPort.metadata(dto.projetoIds);

    const result: MetadataBatchResponseItemDto[] = [];
    for (const [projetoId, meta] of metadataMap.entries()) {
      result.push({ projetoId, autor: meta.autor ?? null });
    }

    this.logger.log(
      `POST metadata/batch returned=${result.length} of requested=${dto.projetoIds.length}`,
    );

    return result;
  }
}
