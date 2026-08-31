import { Global, Injectable, Module } from '@nestjs/common';

import { AdvanceProjetoStatusPort, type AdvanceProjetoStatusResult, type ProjetoTargetStatus } from '../../../modules/pub/ports/advance-projeto-status.port';
import { CompositionLayoutPort } from '../../../modules/pub/ports/composition-layout.port';
import { CompositionMetadataPort } from '../../../modules/pub/ports/composition-metadata.port';
import { ManuscriptContentPort } from '../../../modules/pub/ports/manuscript-content.port';
import { CompositionLayoutStub, CompositionMetadataStub } from './composition-read.stub';
import { ManuscriptContentStub } from './manuscript-content.stub';

/**
 * Thin no-op stub for AdvanceProjetoStatusPort (PUB-012).
 *
 * Logs nothing and always reports `changed: true` so the build job
 * completes its terminal path without a real PROJ service.
 * Replaced in P6 (INT-PUB-003) by the real in-process adapter.
 */
@Injectable()
class AdvanceProjetoStatusStub implements AdvanceProjetoStatusPort {
  async advanceTo(input: { projetoId: string; targetStatus: ProjetoTargetStatus }, _bearerToken: string): Promise<AdvanceProjetoStatusResult> {
    return { projetoId: input.projetoId, newStatus: input.targetStatus, changed: true };
  }
}

/**
 * Global stub module — binds all cross-context outbound ports (IMP, COMP, PROJ)
 * to in-process fixtures so `PubModule` is fully wired in dev/test without
 * requiring sibling services (PUB-012, P4).
 *
 * Used when `PUB_USE_STUBS=true` or `NODE_ENV=test`. In production (P6)
 * these providers are replaced by real adapters without touching domain/modules.
 *
 * RULE-05 note: infrastructure/ imports port interfaces (type-only) from
 * modules/pub/ports/ — acceptable for implementing the contract; no service
 * classes or implementation classes are imported from modules/.
 */
@Global()
@Module({
  providers: [
    ManuscriptContentStub,
    CompositionMetadataStub,
    CompositionLayoutStub,
    AdvanceProjetoStatusStub,
    { provide: ManuscriptContentPort, useExisting: ManuscriptContentStub },
    { provide: CompositionMetadataPort, useExisting: CompositionMetadataStub },
    { provide: CompositionLayoutPort, useExisting: CompositionLayoutStub },
    { provide: AdvanceProjetoStatusPort, useExisting: AdvanceProjetoStatusStub },
  ],
  exports: [
    ManuscriptContentPort,
    CompositionMetadataPort,
    CompositionLayoutPort,
    AdvanceProjetoStatusPort,
  ],
})
export class StubsModule {}
