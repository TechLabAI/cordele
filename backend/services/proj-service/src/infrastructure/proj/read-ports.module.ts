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
 * P4 (PROJ-009): registers functional in-memory stubs as defaults.
 * PROJ-INT-001..003: swap `useClass` to the real HTTP adapters once
 * IMP/COMP/PUB services are scaffolded.
 *
 * RULE-04: modules/ must not import infrastructure/ directly.
 * RULE-05: infrastructure/ must not import modules/. ✓ (tokens from domain/)
 */

import { Global, Module } from '@nestjs/common';

// Tokens imported from DOMAIN port files (infrastructure → domain is permitted)
import { ManuscriptSummaryPort } from '../../domain/proj/ports/outbound/manuscript-summary.port';
import { ProjectMetadataPort } from '../../domain/proj/ports/outbound/project-metadata.port';
import { PublicationHistoryPort } from '../../domain/proj/ports/outbound/publication-history.port';

import { ManuscriptSummaryStub } from '../stubs/proj/manuscript-summary.stub';
import { ProjectMetadataStub } from '../stubs/proj/project-metadata.stub';
import { PublicationHistoryStub } from '../stubs/proj/publication-history.stub';

@Global()
@Module({
  providers: [
    /**
     * PROJ-009 / PROJ-INT-001: ManuscriptSummaryPort → in-memory stub.
     * Replace useClass with ImpManuscriptSummaryAdapter when IMP is scaffolded.
     */
    {
      provide: ManuscriptSummaryPort,
      useClass: ManuscriptSummaryStub,
    },

    /**
     * PROJ-009 / PROJ-INT-002: ProjectMetadataPort → in-memory stub.
     * Replace useClass with CompProjectMetadataAdapter when COMP is scaffolded.
     */
    {
      provide: ProjectMetadataPort,
      useClass: ProjectMetadataStub,
    },

    /**
     * PROJ-009 / PROJ-INT-003: PublicationHistoryPort → in-memory stub.
     * Replace useClass with PubPublicationHistoryAdapter when PUB is scaffolded.
     */
    {
      provide: PublicationHistoryPort,
      useClass: PublicationHistoryStub,
    },
  ],
  exports: [
    ManuscriptSummaryPort,
    ProjectMetadataPort,
    PublicationHistoryPort,
  ],
})
export class ReadPortsModule {}
