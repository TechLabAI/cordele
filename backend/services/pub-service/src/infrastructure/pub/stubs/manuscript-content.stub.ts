import { Injectable } from '@nestjs/common';

import type { ManuscriptContentPort, ManuscriptContentTree } from '../../../modules/pub/ports/manuscript-content.port';

/**
 * In-process stub for ManuscriptContentPort (PUB-012, P4).
 *
 * Returns a deterministic fixture tree so `PublicationBuildJob` and BDD tests
 * can run without a real IMP service. Replace with the real adapter in P6
 * (INT-PUB-001) by swapping the provider in AppModule.
 *
 * Controlled by env vars (not by constructor args) so the same module can
 * cover both positive and negative pre-flight test paths without
 * re-instantiating the module.
 */
@Injectable()
export class ManuscriptContentStub implements ManuscriptContentPort {
  async getContentTree(projetoId: string, _bearerToken: string): Promise<ManuscriptContentTree | null> {
    if (process.env['PUB_MANUSCRIPT_STUB_NULL'] === 'true') {
      return null;
    }

    return {
      manuscritoId: `stub-manuscrito-${projetoId}`,
      estrutura: [
        {
          type: 'chapter',
          title: 'Capítulo 1',
          blocks: [
            {
              type: 'paragraph',
              runs: [{ text: 'Primeiro parágrafo do manuscrito stub.' }],
            },
            {
              type: 'paragraph',
              runs: [{ text: 'Segundo parágrafo do manuscrito stub.' }],
            },
            {
              type: 'image',
              storageKey: `stubs/image-${projetoId}.jpg`,
              alt: 'Imagem stub',
            },
          ],
        },
      ],
    };
  }
}
