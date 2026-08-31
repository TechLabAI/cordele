/**
 * ReadPortsModule — global provider module for the three outbound read ports
 * (ManuscriptSummaryPort, ProjectMetadataPort, PublicationHistoryPort).
 *
 * Follows the same @Global() pattern as PersistenceModule: the providers
 * are registered here and injected anywhere without importing this module
 * directly from feature modules (RULE-04 compliance).
 *
 * Token imports come from the domain port files — infrastructure/ is allowed
 * to import domain/ (RULE-05 bars modules/ → infrastructure/ only, not the
 * reverse, and allows infrastructure/ → domain/).
 *
 * P4 Fase 3 (PROJ-INT-001..003): IMP/COMP/PUB are now scaffolded, so each port
 * resolves to its real HTTP adapter when the sibling service URL
 * (IMP_SERVICE_URL / COMP_SERVICE_URL / PUB_SERVICE_URL) is configured, and
 * falls back to the PROJ-009 in-memory stub otherwise (local/dev/test without
 * the sibling service running). Both branches never throw — the use cases'
 * degraded-mode handling (SPEC-07) is unaffected by which branch is active.
 *
 * RULE-04: modules/ must not import infrastructure/ directly.
 * RULE-05: infrastructure/ must not import modules/. ✓ (tokens from domain/)
 */

import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Tokens imported from DOMAIN port files (infrastructure → domain is permitted)
import { ManuscriptSummaryPort } from '../../domain/proj/ports/outbound/manuscript-summary.port';
import { ProjectMetadataPort } from '../../domain/proj/ports/outbound/project-metadata.port';
import { PublicationHistoryPort } from '../../domain/proj/ports/outbound/publication-history.port';

import { ManuscriptSummaryStub } from '../stubs/proj/manuscript-summary.stub';
import { ProjectMetadataStub } from '../stubs/proj/project-metadata.stub';
import { PublicationHistoryStub } from '../stubs/proj/publication-history.stub';

import { ImpManuscriptSummaryAdapter } from './read/manuscript-summary.adapter';
import { CompProjectMetadataAdapter } from './read/project-metadata.adapter';
import { PubPublicationHistoryAdapter } from './read/publication-history.adapter';

@Global()
@Module({
  providers: [
    // Real adapters and stubs are both registered so the factories below can
    // resolve either one from Nest's container.
    ImpManuscriptSummaryAdapter,
    ManuscriptSummaryStub,
    CompProjectMetadataAdapter,
    ProjectMetadataStub,
    PubPublicationHistoryAdapter,
    PublicationHistoryStub,

    /**
     * PROJ-INT-001: ManuscriptSummaryPort → ImpManuscriptSummaryAdapter when
     * IMP_SERVICE_URL is configured; ManuscriptSummaryStub otherwise.
     */
    {
      provide: ManuscriptSummaryPort,
      useFactory: (
        config: ConfigService,
        real: ImpManuscriptSummaryAdapter,
        stub: ManuscriptSummaryStub,
      ) => (config.get<string>('IMP_SERVICE_URL') ? real : stub),
      inject: [ConfigService, ImpManuscriptSummaryAdapter, ManuscriptSummaryStub],
    },

    /**
     * PROJ-INT-002: ProjectMetadataPort → CompProjectMetadataAdapter when
     * COMP_SERVICE_URL is configured; ProjectMetadataStub otherwise.
     */
    {
      provide: ProjectMetadataPort,
      useFactory: (
        config: ConfigService,
        real: CompProjectMetadataAdapter,
        stub: ProjectMetadataStub,
      ) => (config.get<string>('COMP_SERVICE_URL') ? real : stub),
      inject: [ConfigService, CompProjectMetadataAdapter, ProjectMetadataStub],
    },

    /**
     * PROJ-INT-003: PublicationHistoryPort → PubPublicationHistoryAdapter when
     * PUB_SERVICE_URL is configured; PublicationHistoryStub otherwise.
     */
    {
      provide: PublicationHistoryPort,
      useFactory: (
        config: ConfigService,
        real: PubPublicationHistoryAdapter,
        stub: PublicationHistoryStub,
      ) => (config.get<string>('PUB_SERVICE_URL') ? real : stub),
      inject: [ConfigService, PubPublicationHistoryAdapter, PublicationHistoryStub],
    },
  ],
  exports: [
    ManuscriptSummaryPort,
    ProjectMetadataPort,
    PublicationHistoryPort,
  ],
})
export class ReadPortsModule {}
